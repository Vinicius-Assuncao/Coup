// Cliente do modo online. A lógica roda no servidor (Edge Function); aqui só mostramos o estado e enviamos ações.
const cfg = window.MP_CONFIG;
const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LABEL = {
  renda: 'Renda (+1)', ajuda: 'Ajuda Externa (+2)', golpe: 'Golpe de Estado (7)',
  taxas: 'Duque: Taxas (+3)', assassinar: 'Assassinar (3)', extorquir: 'Capitão: Extorquir (2)',
  trocar: 'Trocar cartas', investigar: 'Inquisidor: Investigar',
};
const TARGET = { golpe: true, assassinar: true, extorquir: true, investigar: true };

let uid = null;
let code = localStorage.getItem('coup-room');
let data = null, chan = null, selecting = null, exKey = null, exPicked = [];
let renderedLogs = [], sending = false;

function seatXY(i, n) {
  const a = Math.PI / 2 + i * 2 * Math.PI / n;
  if (window.matchMedia('(max-width: 700px)').matches) {
    return { x: 50 + 30 * Math.cos(a), y: 49 + 31 * Math.sin(a) };
  }
  const horizontalRadius = n >= 5 ? 30 : (n === 4 ? 34 : 40);
  return { x: 50 + horizontalRadius * Math.cos(a), y: 50 + 36 * Math.sin(a) };
}
function face(role, dead, fresh = false, challengeFlip = false) {
  const i = CARD_INFO[role];
  return `<div class="cd${dead ? ' dead' : ''}${fresh ? ' new-reveal' : ''}${challengeFlip ? ' challenge-reveal' : ''}" style="border-color:${i.c}"><div class="t" style="background:${i.c}">${ROLE_NAMES[role]}</div><svg class="art" viewBox="0 0 110 84" style="background:${i.bg}">${ART[role]}</svg><div class="txt">${i.e}</div></div>`;
}
function appendCard(hand, markup) {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const card = holder.firstElementChild;
  hand.appendChild(card);
  return card;
}

async function call(action, extra = {}) {
  const { data: res, error } = await sb.functions.invoke('coup', { body: { action, code, ...extra } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return res;
}
function showErr(e) {
  const msg = e?.message || String(e);
  $('err').textContent = msg;
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#7a1f1f;color:#fff;padding:8px 14px;border-radius:8px;z-index:99;font:14px sans-serif;max-width:90vw';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.hidden = true; }, 5000);
  console.error('[coup]', e);
}

async function init() {
  if (!cfg?.url || !cfg?.anonKey || cfg.url.includes('SEU-PROJETO')) {
    $('err').textContent = 'Configure o mp-config.js com a URL e a chave do seu projeto Supabase.';
    $('entry').hidden = false;
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw new Error('Ative "Anonymous sign-ins" no Supabase: ' + error.message);
    }

    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) throw userError || new Error('Não foi possível autenticar.');
    uid = userData.user.id;

    if (code) {
      try {
        await enter(code);
        // Se a última sessão salva já terminou (por exemplo, a aba foi fechada
        // antes do aviso de fim), abre o menu em vez de prender o usuário nela.
        if (data?.room?.status === 'finished') await leaveRoom();
        return;
      } catch (e) {
        console.warn('[coup] Não foi possível retomar a sala salva:', e);
        localStorage.removeItem('coup-room');
        code = null;
      }
    }
    $('entry').hidden = false;
  } catch (e) {
    showErr(e);
    $('entry').hidden = false;
  }
}

async function enter(c) {
  const roomCode = String(c || '').trim().toUpperCase();
  if (!roomCode) throw new Error('Informe o código da sala.');

  code = roomCode;
  await refresh();
  if (!data?.room) throw new Error('Não foi possível carregar a sala.');

  $('entry').hidden = true;
  $('room').hidden = false;
  subscribe();
}

let refreshTask = null;
let refreshQueued = false;
let lastSig = '';

async function refresh() {
  if (!code) return;
  // Coalesce eventos simultâneos, mas faz uma nova leitura ao terminar para não
  // perder atualizações que cheguem enquanto a Edge Function está respondendo.
  if (refreshTask) {
    refreshQueued = true;
    return refreshTask;
  }

  refreshTask = (async () => {
    do {
      refreshQueued = false;
      const requestedCode = code;
      const res = await callRetry('get');
      if (requestedCode !== code) return;
      if (!res?.room || !res?.state) throw new Error('Resposta inválida do servidor.');

      const previousData = data;
      data = res;
      lastSig = sigOf(res.room.version, res.room.status, res.lobby || []);

      // A sala continua visível nesta aba para mostrar o vencedor, mas não deve
      // ser reaberta automaticamente quando o usuário voltar ao multiplayer.
      if (res.room.status === 'finished') {
        localStorage.removeItem('coup-room');
      } else {
        localStorage.setItem('coup-room', requestedCode);
      }
      render(previousData);
    } while (refreshQueued && code);
  })();

  try {
    await refreshTask;
  } finally {
    refreshTask = null;
    if (refreshQueued && code) refresh().catch(showErr);
  }
}

async function callRetry(action, extra) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await call(action, extra); }
    catch (e) {
      last = e;
      if (i < 2) await new Promise(r => setTimeout(r, 350 * (i + 1)));
    }
  }
  throw last;
}

const sigOf = (version, status, players) => JSON.stringify([
  version,
  status,
  (players || []).map(p => [p.user_id, p.name || '']).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
]);

function subscribe() {
  if (!code) return;
  if (chan) {
    sb.removeChannel(chan).catch(e => console.warn('[coup] remove channel:', e));
    chan = null;
  }

  const subscribedCode = code;
  chan = sb.channel('coup-room-' + subscribedCode)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${subscribedCode}`,
    }, () => {
      if (code === subscribedCode) refresh().catch(showErr);
    })
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'room_players', filter: `room_code=eq.${subscribedCode}`,
    }, () => {
      if (code === subscribedCode) refresh().catch(showErr);
    })
    .subscribe((status, err) => {
      console.log('[coup] Realtime:', status, err || '');
      if (status === 'SUBSCRIBED' && code === subscribedCode) {
        // Recupera alterações que ocorreram antes da inscrição ser confirmada.
        refresh().catch(showErr);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[coup] Realtime indisponível; a consulta periódica continuará ativa.', err || status);
      }
    });
}

// Contingência para quando o Realtime não estiver habilitado/configurado no projeto.
// Consulta só os metadados públicos; a Edge Function é chamada apenas se houver mudança.
async function poll() {
  if (!code || !data || document.hidden) return;
  const checkedCode = code;

  try {
    const [roomResult, playersResult] = await Promise.all([
      sb.from('rooms').select('version,status').eq('code', checkedCode).maybeSingle(),
      sb.from('room_players').select('user_id,name').eq('room_code', checkedCode),
    ]);

    if (checkedCode !== code) return;
    if (roomResult.error) throw roomResult.error;
    if (playersResult.error) throw playersResult.error;
    if (!roomResult.data) throw new Error('A sala não existe mais.');

    const sig = sigOf(roomResult.data.version, roomResult.data.status, playersResult.data || []);
    if (sig !== lastSig) await refresh();
  } catch (e) {
    // Não interrompe o jogo por uma falha momentânea de leitura; Realtime e a
    // próxima consulta tentam novamente.
    console.warn('[coup] Consulta de sincronização:', e);
  }
}

const pollTimer = setInterval(() => poll(), 1500);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && code && data) refresh().catch(showErr);
});
window.addEventListener('focus', () => {
  if (code && data) refresh().catch(() => {});
});
window.addEventListener('pageshow', () => {
  // Recria a inscrição quando o navegador restaura a página pelo botão Voltar.
  if (code && data) {
    subscribe();
    refresh().catch(showErr);
  }
});

// Prazo: qualquer cliente pode pedir ao servidor que aplique a ação padrão.
let ticking = false;
setInterval(async () => {
  updateTimer();
  const pd = data?.state?.pending;
  if (!ticking && data?.room?.status === 'playing' && pd && Date.now() > pd.deadline) {
    ticking = true;
    try { await call('tick'); await refresh(); }
    catch (e) { console.warn('[coup] tick:', e); }
    finally { ticking = false; }
  }
}, 1000);

async function leaveRoom() {
  localStorage.removeItem('coup-room');
  code = null;
  data = null;
  selecting = null;
  exKey = null;
  exPicked = [];
  renderedLogs = [];
  lastSig = '';
  $('events').innerHTML = '';
  $('fly').innerHTML = '';
  $('log').innerHTML = '';

  if (chan) {
    const current = chan;
    chan = null;
    try { await sb.removeChannel(current); }
    catch (e) { console.warn('[coup] Não foi possível encerrar o canal:', e); }
  }

  $('room').hidden = true;
  $('entry').hidden = false;
  $('err').textContent = '';
  $('codeIn').value = '';
}

function render(previousData) {
  if (!data) return;
  const lobby = data.room.status === 'lobby';
  $('lobby').hidden = !lobby;
  $('game').hidden = lobby;
  if (lobby) renderLobby(); else renderGame(previousData);
}

function renderLobby() {
  $('roomCode').textContent = data.room.code;
  $('lobbyList').innerHTML = data.lobby.map(p => `<li>${esc(p.name)}${p.user_id === uid ? ' (você)' : ''}</li>`).join('');
  const isHost = data.room.host_id === uid;
  $('btnStart').hidden = !isHost;
  $('btnStart').disabled = data.lobby.length < 2;
  $('lobbyMsg').textContent = isHost
    ? (data.lobby.length < 2 ? 'Aguardando mais jogadores (mínimo 2)' : 'Compartilhe o código com seus amigos')
    : 'Aguardando o anfitrião iniciar a partida';
}

function renderGame(previousData) {
  const st = data.state, players = st.players, n = players.length;
  const meIdx = players.findIndex(p => p.id === uid);
  const base = meIdx < 0 ? 0 : meIdx;
  const myMap = {};
  const myHand = data.me?.hand || [];
  myHand.forEach(c => { myMap[c.i] = c.role; });
  const pd = st.pending;
  const choosingLoss = pd?.k === 'lose' && pd.pid === uid;
  const choosingReveal = pd?.k === 'inv1' && pd.t === uid;
  const choosingExchange = pd?.k === 'exchange' && pd.pid === uid;
  const oldPlayers = new Map((previousData?.state?.players || []).map(p => [p.id, p]));
  animateStateChanges(previousData?.state, st);
  const seats = $('seats');
  seats.innerHTML = '';
  for (let k = 0; k < n; k++) {
    const pl = players[(base + k) % n];
    const xy = seatXY(k, n);
    const isTurn = st.status === 'playing' && players[st.turn]?.id === pl.id;
    const el = document.createElement('div');
    el.dataset.id = pl.id;
    el.className = 'seat ' + (pl.id === uid ? 'me' : 'sm') + (isTurn ? ' active' : '') + (pl.alive ? '' : ' out')
      + (selecting && pl.alive && pl.id !== uid ? ' targetable' : '');
    el.style.left = xy.x + '%';
    el.style.top = xy.y + '%';
    const side = pl.id === uid ? 'me' : (xy.x < 50 ? 'left' : 'right');
    const old = oldPlayers.get(pl.id);
    el.innerHTML = `<div class="bslot ${side}"></div>
      <div class="sname">${esc(pl.name)}${pl.id === uid ? ' · você' : ''}</div>
      <div class="scoin"><span class="gold"></span>${pl.coins}${pl.alive ? '' : ' · fora'}</div>
      <div class="hand"></div>`;
    if (old && old.coins !== pl.coins) el.querySelector('.scoin').classList.add('coin-update');
    const previousTurn = previousData?.state?.players?.[previousData.state.turn]?.id;
    if (isTurn && previousData && previousTurn !== players[st.turn]?.id) {
      el.querySelector('.sname').classList.add('turn-arrival');
    }
    const handEl = el.querySelector('.hand');
    const oldOwnHand = previousData?.me?.hand || [];
    if (pl.id === uid && choosingExchange) {
      pl.cards.forEach((card, j) => {
        if (card.dead) appendCard(handEl, face(card.role, true));
      });
      (data.me?.pool || []).forEach((role, i) => {
        const selected = exPicked.includes(i);
        const node = appendCard(handEl, face(role, false));
        node.classList.add('exchange-choice');
        if (selected) node.classList.add('exchange-selected');
        node.title = selected ? 'Remover seleção' : 'Selecionar esta carta';
        node.setAttribute('aria-label', `${selected ? 'Selecionada: ' : 'Selecionar '}${ROLE_NAMES[role]}`);
        node.onclick = () => {
          if (exPicked.includes(i)) exPicked = exPicked.filter(x => x !== i);
          else if (exPicked.length < pd.keep) exPicked.push(i);
          if (exPicked.length === pd.keep) send({ keep: exPicked.slice() });
          else renderGame();
        };
      });
    } else {
      pl.cards.forEach((card, j) => {
        let markup = BACK;
        if (card.dead) markup = face(card.role, true);
        else if (pl.id === uid && myMap[j]) {
          const previousRole = oldOwnHand.find(c => c.i === j)?.role;
          markup = face(myMap[j], false, previousRole !== undefined && previousRole !== myMap[j]);
        }
        const node = appendCard(handEl, markup);
        if (pl.id === uid && !card.dead && (choosingLoss || choosingReveal)) {
          const known = myHand.find(c => c.i === j);
          if (known) {
            node.classList.add('card-selectable');
            node.title = choosingLoss ? 'Clique para perder esta influência' : 'Clique para revelar esta carta';
            node.setAttribute('aria-label', `${node.title}: ${ROLE_NAMES[known.role]}`);
            node.onclick = () => send({ index: j });
          }
        }
        if (card.dead && !old?.cards?.[j]?.dead) {
          node.classList.add('challenge-reveal');
        }
      });
    }

    if (selecting && pl.alive && pl.id !== uid) {
      el.onclick = event => {
        if (event.target.closest('.cd')) return;
        const type = selecting;
        selecting = null;
        send({ type, target: pl.id });
      };
    }
    seats.appendChild(el);
  }
  $('deckCount').textContent = `Baralho: ${st.deckCount ?? ''}`;
  $('treasury').textContent = st.treasury;
  renderControls();
  renderLog();
  updateTimer();
  repositionEvents();
}

function renderControls() {
  document.querySelectorAll('#events .pop').forEach(p => p.remove());
  const st = data.state, pd = st.pending, c = $('controls');
  c.innerHTML = '';
  c.classList.remove('action-menu');
  const nm = id => st.players.find(p => p.id === id)?.name || '?';
  const leaveButton = $('btnLeaveGame');
  leaveButton.hidden = st.status !== 'finished';
  if (st.status === 'finished') {
    $('now').textContent = `🏆 ${nm(st.winner)} venceu a partida!`;
    c.innerHTML = '<p>Partida encerrada.</p>';
    return;
  }
  if (!pd) { $('now').textContent = ''; return; }
  const me = st.players.find(p => p.id === uid);
  const myHand = data.me?.hand || [];

  switch (pd.k) {
    case 'action':
      if (pd.pid === uid) {
        setNow(selecting ? 'Clique no jogador alvo.' : 'Sua vez. Escolha uma ação.');
        buildActions(me, c);
      } else {
        setNow(`Aguardando ${nm(pd.pid)} escolher uma ação...`);
      }
      break;
    case 'resp': {
      const mine = pd.responders.includes(uid) && !(uid in pd.answers);
      if (pd.kind === 'challenge') {
        setNow(`${nm(pd.claimer)} afirma ser ${ROLE_NAMES[pd.role]}.`);
        if (mine) pop(uid, `Desafiar ${nm(pd.claimer)}?`, [
          { label: '⚔️ Desafiar', v: { challenge: true }, primary: true },
          { label: 'Deixar passar', v: { challenge: false }, className: 'neutral' },
        ]);
      } else {
        setNow(`${nm(pd.actor)} usa ${LABEL[pd.type]}. Alguém quer bloquear?`);
        if (mine) pop(uid, 'Bloquear?', [
          ...pd.blockers.map(r => ({
            label: `${ROLE_ICON[r] || '🛡️'} Bloquear com ${ROLE_NAMES[r]}`,
            v: { block: r },
            className: `role-${r}${myHand.some(h => h.role === r) ? '' : ' action-unavailable'}`,
            title: myHand.some(h => h.role === r) ? '' : `Você não tem ${ROLE_NAMES[r]}; ainda pode blefar.`,
          })),
          { label: 'Não bloquear', v: { block: null }, className: 'neutral' },
        ]);
      }
      break;
    }
    case 'lose':
      setNow(`${nm(pd.pid)} precisa perder uma influência.`);
      if (pd.pid === uid) c.innerHTML = '<p class="card-prompt">Clique na carta que deseja perder.</p>';
      break;
    case 'exchange':
      if (exKey !== pd.deadline) { exKey = pd.deadline; exPicked = []; }
      if (pd.pid === uid) {
        setNow(`Escolha ${pd.keep} carta(s) para manter.`);
        c.innerHTML = `<p class="card-prompt">Clique nas cartas para selecionar (${exPicked.length}/${pd.keep}).</p>`;
      } else {
        setNow(`${nm(pd.pid)} está trocando cartas com a Corte...`);
      }
      break;
    case 'inv1':
      if (pd.t === uid) {
        setNow(`${nm(pd.a)} está investigando você.`);
        c.innerHTML = '<p class="card-prompt">Clique na carta que deseja revelar.</p>';
      } else {
        setNow(`${nm(pd.a)} está investigando ${nm(pd.t)}...`);
      }
      break;
    case 'inv2':
      if (pd.a === uid) {
        setNow('Você viu a carta.');
        pop(uid, `Você viu ${ROLE_NAMES[data.me?.peek] || ''}. Forçar troca?`, [
          { label: 'Forçar troca', v: { force: true }, primary: true, className: 'role-inquisidor' },
          { label: 'Deixar', v: { force: false }, className: 'neutral' },
        ]);
      } else {
        setNow(`${nm(pd.a)} está investigando ${nm(pd.t)}...`);
      }
      break;
  }
}

const ACTION_ROLE = {
  taxas: 'duque', assassinar: 'assassino', extorquir: 'capitao',
  trocar: null, investigar: 'inquisidor',
};
const ACTION_ICON = {
  renda: '💰', ajuda: '🤝', golpe: '⚔️', taxas: '👑',
  assassinar: '🗡️', extorquir: '🛡️', trocar: '📜', investigar: '👁️',
};

function buildActions(me, c) {
  let keys;
  if (me.coins >= 10) keys = ['golpe'];
  else {
    keys = ['renda', 'ajuda', 'taxas', 'trocar', 'extorquir'];
    if (me.coins >= 3) keys.push('assassinar');
    if (me.coins >= 7) keys.push('golpe');
    if (data.state.ex === 'inquisidor') keys.push('investigar');
  }
  c.classList.add('action-menu');
  const myRoles = (data.me?.hand || []).map(h => h.role);
  keys.forEach(k => {
    const b = document.createElement('button');
    const role = k === 'trocar' ? data.state.ex : ACTION_ROLE[k];
    const unavailable = role && !myRoles.includes(role);
    b.textContent = `${ACTION_ICON[k]} ${k === 'trocar' ? `${ROLE_NAMES[role]}: ` : ''}${LABEL[k]}`;
    b.className = k === 'golpe' ? 'action-coup' : role
      ? `action-role role-${role}${unavailable ? ' action-unavailable' : ''}`
      : 'action-neutral';
    if (unavailable) b.title = `Você não tem ${ROLE_NAMES[role]}; a ação ainda pode ser usada como blefe.`;
    b.onclick = () => {
      if (TARGET[k]) { selecting = k; renderGame(); }
      else send({ type: k });
    };
    c.appendChild(b);
  });
  if (selecting) {
    const b = document.createElement('button');
    b.textContent = 'Cancelar escolha de alvo';
    b.className = 'neutral';
    b.onclick = () => { selecting = null; renderGame(); };
    c.appendChild(b);
  }
}

function setNow(text) {
  const now = $('now');
  now.textContent = text;
  now.classList.remove('bump');
  void now.offsetWidth;
  now.classList.add('bump');
}

// Popups usam a mesma camada flutuante, animações e identidade visual do modo local.
function pop(pid, msg, options) {
  const box = document.createElement('div');
  box.className = 'pop';
  const message = document.createElement('div');
  message.className = 'popmsg';
  message.textContent = msg;
  box.appendChild(message);
  options.forEach(o => {
    const b = document.createElement('button');
    b.textContent = o.label;
    b.className = [o.className, o.primary ? 'primary' : ''].filter(Boolean).join(' ');
    if (o.title) b.title = o.title;
    b.onclick = () => { box.remove(); if (o.local) o.local(); else send(o.v); };
    box.appendChild(b);
  });
  const player = data.state.players.find(p => p.id === pid);
  if (!player || !attachFloatingEvent(box, player.id)) box.remove();
}

async function send(payload) {
  if (sending) return;
  sending = true;
  $('loadingIndicator').hidden = false;
  try {
    $('err').textContent = '';
    selecting = null;
    await call('act', { payload });
    await refresh();
  } catch (e) {
    showErr(e);
    await refresh().catch(() => {});
  } finally {
    sending = false;
    $('loadingIndicator').hidden = true;
  }
}

function logEmoji(text) {
  if (text.includes('Partida iniciada')) return '🎲';
  if (text.includes(' venceu a partida')) return '🏆';
  if (text.includes(' não tinha ') || text.includes('Perde o desafio')) return '❌';
  if (text.includes('mostra ') && text.includes('era verdade')) return '✅';
  if (text.includes('afirma ser ') && text.includes('bloqueia')) return '🛡️';
  if (text.includes(' afirma ser ')) return '🛡️';
  if (text.includes('desafia')) return '⚔️';
  if (text.includes(' recebe ')) return '💰';
  if (text.includes(' rouba ')) return '🪙';
  if (text.includes('perde ') || text.includes('assassinado') || text.includes('está fora')) return '💔';
  if (text.includes('Golpe em')) return '⚔️';
  if (text.includes('investiga')) return '👁️';
  if (text.includes('trocou cartas') || text.includes('forçado a trocar')) return '🃏';
  if (text.includes('bloqueada')) return '🛡️';

  const action = text.match(/^.+? usa (.+)\.$/);
  if (action) {
    const type = action[1].split(' contra ')[0];
    if (type.startsWith('Renda')) return '💰';
    if (type.startsWith('Ajuda')) return '🤝';
    if (type.startsWith('Golpe')) return '⚔️';
    if (type.startsWith('Duque')) return '👑';
    if (type.startsWith('Assassino')) return '🗡️';
    if (type.startsWith('Capitão')) return '🛡️';
    if (type.startsWith('Trocar')) return '🃏';
    if (type.startsWith('Inquisidor')) return '👁️';
  }
  return '•';
}

function renderLog() {
  const el = $('log');
  const logs = data.state.log || [];
  let common = 0;
  while (common < renderedLogs.length && common < logs.length
    && renderedLogs[common].t === logs[common].t && renderedLogs[common].h === logs[common].h) common++;
  if (common !== renderedLogs.length) {
    el.innerHTML = '';
    common = 0;
  }
  for (const entry of logs.slice(common)) {
    const action = entry.t.match(/^(.+?) usa (.+)\.$/);
    if (action) {
      const heading = document.createElement('p');
      heading.className = 'head turn-head';
      heading.textContent = `🎯 Vez de ${action[1]} —`;
      el.appendChild(heading);
    }
    const line = document.createElement('p');
    line.textContent = `${logEmoji(entry.t)} ${entry.t}`;
    if (entry.h) line.className = 'head';
    el.appendChild(line);
  }
  renderedLogs = logs.slice();
  el.scrollTop = el.scrollHeight;
}

function eventLayer() { return $('events'); }
function seatOf(pid) { return [...document.querySelectorAll('.seat')].find(el => el.dataset.id === pid) || null; }
function intersects(a, b, gap = 6) {
  return a.left < b.right + gap && a.right + gap > b.left
    && a.top < b.bottom + gap && a.bottom + gap > b.top;
}
function placeFloatingEvent(el, pid) {
  const anchor = seatOf(pid), layer = eventLayer();
  if (!anchor || !layer) return false;
  const anchorRect = anchor.getBoundingClientRect();
  const width = el.offsetWidth || 180, height = el.offsetHeight || 36;
  const cx = anchorRect.left + anchorRect.width / 2;
  const cy = anchorRect.top + anchorRect.height / 2;
  const gap = 24;
  const candidates = [
    [cx, anchorRect.top - height / 2 - gap],
    [cx, anchorRect.bottom + height / 2 + gap],
    [anchorRect.left - width / 2 - gap, cy],
    [anchorRect.right + width / 2 + gap, cy],
    [cx - width * .42, anchorRect.top - height / 2 - gap],
    [cx + width * .42, anchorRect.top - height / 2 - gap],
    [cx - width * .42, anchorRect.bottom + height / 2 + gap],
    [cx + width * .42, anchorRect.bottom + height / 2 + gap],
  ];
  const obstacles = [
    ...[...document.querySelectorAll('.seat,.side')].map(x => x.getBoundingClientRect()),
    ...[...layer.children].filter(x => x !== el).map(x => x.getBoundingClientRect()),
  ];
  let best = null, bestScore = Infinity;
  for (const [rawX, rawY] of candidates) {
    const x = Math.max(width / 2 + 8, Math.min(innerWidth - width / 2 - 8, rawX));
    const y = Math.max(height / 2 + 8, Math.min(innerHeight - height / 2 - 8, rawY));
    const rect = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
    let score = 0;
    for (const obstacle of obstacles) {
      if (intersects(rect, obstacle, 7)) {
        const w = Math.max(0, Math.min(rect.right, obstacle.right) - Math.max(rect.left, obstacle.left));
        const h = Math.max(0, Math.min(rect.bottom, obstacle.bottom) - Math.max(rect.top, obstacle.top));
        score += Math.max(1, w * h);
      }
    }
    if (score < bestScore) { bestScore = score; best = { x, y }; }
    if (!score) break;
  }
  if (!best) return false;
  el.style.left = `${best.x}px`;
  el.style.top = `${best.y}px`;
  el.dataset.anchorId = pid;
  return bestScore === 0;
}
function attachFloatingEvent(el, pid) {
  const layer = eventLayer();
  if (!seatOf(pid) || !layer) return false;
  el.style.visibility = 'hidden';
  layer.appendChild(el);
  placeFloatingEvent(el, pid);
  el.style.visibility = 'visible';
  return true;
}
function repositionEvents() {
  [...(eventLayer()?.children || [])].forEach(el => placeFloatingEvent(el, el.dataset.anchorId));
}
function badge(pid, text, kind) {
  const el = document.createElement('div');
  el.className = `badge ${kind || ''}`;
  el.textContent = text;
  if (!attachFloatingEvent(el, pid)) return;
  setTimeout(() => el.remove(), 1900);
}
function fx(kind) {
  const el = $('fx');
  el.className = '';
  void el.offsetWidth;
  el.className = `on-${kind}`;
}
function tablePoint(element) {
  const table = $('table'), tableRect = table.getBoundingClientRect(), rect = element.getBoundingClientRect();
  return {
    x: ((rect.left + rect.width / 2 - tableRect.left - table.clientLeft) / table.clientWidth) * 100,
    y: ((rect.top + rect.height / 2 - tableRect.top - table.clientTop) / table.clientHeight) * 100,
  };
}
function coinPoint(pid) {
  const element = pid ? seatOf(pid)?.querySelector('.scoin .gold') : $('.coin-stack');
  return element ? tablePoint(element) : { x: 50, y: 50 };
}
function flyCoins(fromId, toId, count) {
  const from = coinPoint(fromId), to = coinPoint(toId);
  for (let i = 0; i < Math.min(count, 6); i++) {
    const coin = document.createElement('div');
    coin.className = 'coinfly';
    coin.style.left = `${from.x}%`;
    coin.style.top = `${from.y}%`;
    $('fly').appendChild(coin);
    coin.animate([
      { left: `${from.x}%`, top: `${from.y}%`, opacity: 1 },
      { left: `${to.x}%`, top: `${to.y}%`, opacity: .9 },
    ], { duration: 900, delay: i * 90, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(() => coin.remove(), 1100 + i * 90);
  }
}
function animateCardBack(pid, count = 1) {
  const hand = seatOf(pid)?.querySelector('.hand');
  const target = hand?.querySelector('.cd:not(.dead)') || hand;
  if (!target) return;
  const from = tablePoint($('deck')), to = tablePoint(target);
  const deck = $('deck');
  deck.classList.remove('pile-motion');
  void deck.offsetWidth;
  deck.classList.add('pile-motion');
  for (let i = 0; i < Math.min(count, 2); i++) {
    const card = document.createElement('div');
    card.className = 'fly';
    card.innerHTML = BACK;
    card.style.left = `${from.x}%`;
    card.style.top = `${from.y}%`;
    $('fly').appendChild(card);
    card.animate([
      { left: `${from.x}%`, top: `${from.y}%`, opacity: 1, transform: 'translate(-50%,-50%) scale(.92)' },
      { left: `${to.x}%`, top: `${to.y}%`, opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
    ], { duration: 680, delay: i * 120, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    setTimeout(() => card.remove(), 850 + i * 120);
  }
}
function animateStateChanges(previous, current) {
  if (!previous || !current) return;
  const oldPlayers = new Map(previous.players.map(p => [p.id, p]));
  const changes = current.players.map(p => ({ player: p, delta: p.coins - (oldPlayers.get(p.id)?.coins ?? p.coins) }))
    .filter(x => x.delta);
  const treasuryDelta = current.treasury - previous.treasury;
  const gains = changes.filter(x => x.delta > 0);
  const losses = changes.filter(x => x.delta < 0);
  if (treasuryDelta < 0) gains.forEach(x => {
    flyCoins(null, x.player.id, x.delta);
    badge(x.player.id, `+${x.delta}`, 'ok');
  });
  else if (treasuryDelta > 0) losses.forEach(x => {
    flyCoins(x.player.id, null, -x.delta);
    badge(x.player.id, `−${-x.delta}`, 'bad');
  });
  else {
    changes.forEach(x => badge(x.player.id, `${x.delta > 0 ? '+' : '−'}${Math.abs(x.delta)}`, x.delta > 0 ? 'ok' : 'bad'));
    let from = losses[0], to = gains[0];
    while (from && to) {
      const count = Math.min(-from.delta, to.delta);
      flyCoins(from.player.id, to.player.id, count);
      from.delta += count;
      to.delta -= count;
      if (!from.delta) from = losses.shift();
      if (!to.delta) to = gains.shift();
    }
  }

  const log = current.log || [];
  const oldLog = previous.log || [];
  let start = oldLog.length;
  if (start > log.length || oldLog.slice(-1)[0]?.t !== log[start - 1]?.t) {
    const last = oldLog[oldLog.length - 1];
    const found = last ? log.map(x => x.t).lastIndexOf(last.t) : -1;
    start = found < 0 ? Math.max(0, log.length - 1) : found + 1;
  }
  const added = log.slice(start);
  if (added.some(x => /desafia|afirma ser|perde o desafio/i.test(x.t))) fx('gold');
  else if (added.some(x => /bloqueia|bloqueada/i.test(x.t))) fx('blue');
  else if (added.some(x => /perde|assassinado|golpe em/i.test(x.t))) fx('red');

  for (const entry of added) {
    const text = entry.t;
    let playerName = null, label = '', kind = 'gold';
    if (text.includes(' mostra ') && text.includes('era verdade')) {
      const name = text.split(' mostra ')[0];
      const player = current.players.find(p => p.name === name);
      if (player) animateCardBack(player.id);
    } else if (text.includes(' é forçado a trocar a carta revelada.')) {
      const name = text.split(' é forçado a trocar ')[0];
      const player = current.players.find(p => p.name === name);
      if (player) animateCardBack(player.id);
    } else if (text.includes(' trocou cartas com a Corte.')) {
      const name = text.split(' trocou cartas ')[0];
      const player = current.players.find(p => p.name === name);
      if (player) animateCardBack(player.id, 2);
    }
    if (text.includes(' afirma ser ') && text.includes(' bloqueia.')) {
      playerName = text.split(' afirma ser ')[0];
      label = '🛡️ Bloqueio';
      kind = 'blue';
    } else if (text.includes(' afirma ser ')) {
      playerName = text.split(' afirma ser ')[0];
      label = `🛡️ ${text.split(' afirma ser ')[1].replace('.', '')}`;
    } else if (text.includes(' desafia ')) {
      playerName = text.split(' desafia ')[0];
      label = '⚔️ Desafio';
    } else if (text.includes(' mostra ') && text.includes('era verdade')) {
      playerName = text.split(' mostra ')[0];
      label = '✅ Verdade';
      kind = 'ok';
    } else if (text.includes(' não tinha ')) {
      playerName = text.split(' não tinha ')[0];
      label = '❌ Mentira';
      kind = 'bad';
    }
    const player = current.players.find(p => p.name === playerName);
    if (player && label) badge(player.id, label, kind);
  }

  for (const p of current.players) {
    const old = oldPlayers.get(p.id);
    if (!old) continue;
    const lost = p.cards.filter((card, i) => card.dead && !old.cards[i]?.dead).length;
    if (lost) badge(p.id, '💔 Perde carta', 'bad');
  }
}

function updateTimer() {
  const pd = data?.state?.pending;
  const t = $('timer');
  if (!pd || data?.room?.status !== 'playing') { t.textContent = ''; return; }
  const s = Math.max(0, Math.ceil((pd.deadline - Date.now()) / 1000));
  t.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

window.addEventListener('resize', repositionEvents);
window.addEventListener('scroll', repositionEvents, { passive: true });

$('btnCreate').onclick = async () => {
  try {
    const r = await call('create', { name: $('name').value.trim(), variant: $('variant2').value });
    await enter(r.code);
  } catch (e) { showErr(e); }
};
$('btnJoin').onclick = async () => {
  try {
    const c = $('codeIn').value.trim().toUpperCase();
    await call('join', { code: c, name: $('name').value.trim() });
    await enter(c);
  } catch (e) { showErr(e); }
};
$('btnStart').onclick = async () => {
  try { await call('start'); await refresh(); } catch (e) { showErr(e); }
};
$('btnLeave').onclick = () => leaveRoom().catch(showErr);
$('btnLeaveGame').onclick = () => leaveRoom().catch(showErr);
$('btnTopMenu').onclick = () => leaveRoom().catch(showErr);

init();
