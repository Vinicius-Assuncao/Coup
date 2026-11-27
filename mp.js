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

function seatXY(i, n) {
  const a = Math.PI / 2 + i * 2 * Math.PI / n;
  return { x: 50 + 40 * Math.cos(a), y: 50 + 36 * Math.sin(a) };
}
function face(role, dead) {
  const i = CARD_INFO[role];
  return `<div class="cd${dead ? ' dead' : ''}" style="border-color:${i.c}"><div class="t" style="background:${i.c}">${ROLE_NAMES[role]}</div><svg class="art" viewBox="0 0 110 84" style="background:${i.bg}">${ART[role]}</svg><div class="txt">${i.e}</div></div>`;
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

      data = res;
      lastSig = sigOf(res.room.version, res.room.status, res.lobby || []);

      // A sala continua visível nesta aba para mostrar o vencedor, mas não deve
      // ser reaberta automaticamente quando o usuário voltar ao multiplayer.
      if (res.room.status === 'finished') {
        localStorage.removeItem('coup-room');
      } else {
        localStorage.setItem('coup-room', requestedCode);
      }
      render();
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
  lastSig = '';

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

function render() {
  if (!data) return;
  const lobby = data.room.status === 'lobby';
  $('lobby').hidden = !lobby;
  $('game').hidden = lobby;
  if (lobby) renderLobby(); else renderGame();
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

function renderGame() {
  const st = data.state, players = st.players, n = players.length;
  const meIdx = players.findIndex(p => p.id === uid);
  const base = meIdx < 0 ? 0 : meIdx;
  const myMap = {};
  (data.me?.hand || []).forEach(c => { myMap[c.i] = c.role; });
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
    const hand = pl.cards.map((c, j) => {
      if (c.dead) return face(c.role, true);
      if (pl.id === uid && myMap[j]) return face(myMap[j], false);
      return BACK;
    }).join('');
    el.innerHTML = `<div class="sname">${esc(pl.name)}${pl.id === uid ? ' · você' : ''}</div>
      <div class="scoin"><span class="gold"></span>${pl.coins}${pl.alive ? '' : ' · fora'}</div>
      <div class="hand">${hand}</div>`;
    if (selecting && pl.alive && pl.id !== uid) {
      el.onclick = () => { const t = selecting; selecting = null; send({ type: t, target: pl.id }); };
    }
    seats.appendChild(el);
  }
  $('deck').textContent = `Baralho: ${st.deckCount ?? ''}`;
  $('treasury').textContent = st.treasury;
  renderControls();
  renderLog();
  updateTimer();
}

function renderControls() {
  document.querySelectorAll('.mp-pop').forEach(p => p.remove());
  const st = data.state, pd = st.pending, c = $('controls');
  c.innerHTML = '';
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
        $('now').textContent = selecting ? 'Clique no jogador alvo.' : 'Sua vez. Escolha uma ação.';
        buildActions(me, c);
      } else {
        $('now').textContent = `Aguardando ${nm(pd.pid)} escolher uma ação...`;
      }
      break;
    case 'resp': {
      const mine = pd.responders.includes(uid) && !(uid in pd.answers);
      if (pd.kind === 'challenge') {
        $('now').textContent = `${nm(pd.claimer)} afirma ser ${ROLE_NAMES[pd.role]}.`;
        if (mine) pop(uid, `Desafiar ${nm(pd.claimer)}?`, [
          { label: 'Desafiar', v: { challenge: true }, primary: true },
          { label: 'Deixar passar', v: { challenge: false } },
        ]);
      } else {
        $('now').textContent = `${nm(pd.actor)} usa ${LABEL[pd.type]}. Alguém quer bloquear?`;
        if (mine) pop(uid, 'Bloquear?', [
          ...pd.blockers.map(r => ({ label: `Bloquear com ${ROLE_NAMES[r]}`, v: { block: r } })),
          { label: 'Não bloquear', v: { block: null } },
        ]);
      }
      break;
    }
    case 'lose':
      $('now').textContent = `${nm(pd.pid)} precisa perder uma influência.`;
      if (pd.pid === uid) pop(uid, 'Escolha a carta para revelar',
        myHand.map(h => ({ label: ROLE_NAMES[h.role], v: { index: h.i } })));
      break;
    case 'exchange':
      if (exKey !== pd.deadline) { exKey = pd.deadline; exPicked = []; }
      if (pd.pid === uid) {
        const pool = data.me?.pool || [];
        $('now').textContent = `Escolha ${pd.keep} carta(s) para manter.`;
        if (exPicked.length < pd.keep) {
          pop(uid, `Manter (${exPicked.length + 1}/${pd.keep})`,
            pool.map((r, i) => exPicked.includes(i) ? null : {
              label: ROLE_NAMES[r],
              local: () => {
                exPicked.push(i);
                if (exPicked.length === pd.keep) send({ keep: exPicked.slice() });
                else renderControls();
              },
            }).filter(Boolean));
        }
      } else {
        $('now').textContent = `${nm(pd.pid)} está trocando cartas com a Corte...`;
      }
      break;
    case 'inv1':
      if (pd.t === uid) {
        $('now').textContent = `${nm(pd.a)} está investigando você.`;
        pop(uid, 'Escolha qual carta mostrar', myHand.map(h => ({ label: ROLE_NAMES[h.role], v: { index: h.i } })));
      } else {
        $('now').textContent = `${nm(pd.a)} está investigando ${nm(pd.t)}...`;
      }
      break;
    case 'inv2':
      if (pd.a === uid) {
        $('now').textContent = 'Você viu a carta.';
        pop(uid, `Você viu ${ROLE_NAMES[data.me?.peek] || ''}. Forçar troca?`, [
          { label: 'Forçar troca', v: { force: true }, primary: true },
          { label: 'Deixar', v: { force: false } },
        ]);
      } else {
        $('now').textContent = `${nm(pd.a)} está investigando ${nm(pd.t)}...`;
      }
      break;
  }
}

function buildActions(me, c) {
  let keys;
  if (me.coins >= 10) keys = ['golpe'];
  else {
    keys = ['renda', 'ajuda', 'taxas', 'trocar', 'extorquir'];
    if (me.coins >= 3) keys.push('assassinar');
    if (me.coins >= 7) keys.push('golpe');
    if (data.state.ex === 'inquisidor') keys.push('investigar');
  }
  keys.forEach(k => {
    const b = document.createElement('button');
    b.textContent = LABEL[k];
    if (k === 'golpe') b.className = 'primary';
    b.onclick = () => {
      if (TARGET[k]) { selecting = k; renderGame(); }
      else send({ type: k });
    };
    c.appendChild(b);
  });
  if (selecting) {
    const b = document.createElement('button');
    b.textContent = 'Cancelar escolha de alvo';
    b.onclick = () => { selecting = null; renderGame(); };
    c.appendChild(b);
  }
}

// Popup preso ao jogador. Cada opção envia uma ação ou executa uma função local.
function pop(pid, msg, options) {
  const el = document.querySelector(`.seat[data-id="${pid}"]`);
  if (!el) return;
  const box = document.createElement('div');
  box.className = 'mp-pop';
  box.innerHTML = `<div class="popmsg">${esc(msg)}</div>`;
  options.forEach(o => {
    const b = document.createElement('button');
    b.textContent = o.label;
    if (o.primary) b.className = 'primary';
    b.onclick = () => { box.remove(); if (o.local) o.local(); else send(o.v); };
    box.appendChild(b);
  });
  el.appendChild(box);
}

async function send(payload) {
  try {
    $('err').textContent = '';
    selecting = null;
    await call('act', { payload });
    await refresh();
  } catch (e) {
    showErr(e);
    await refresh().catch(() => {});
  }
}

function renderLog() {
  const el = $('mpLog');
  el.innerHTML = data.state.log.map(l => `<p class="${l.h ? 'head' : ''}">${esc(l.t)}</p>`).join('');
  el.scrollTop = el.scrollHeight;
}

function updateTimer() {
  const pd = data?.state?.pending;
  const t = $('timer');
  if (!pd || data?.room?.status !== 'playing') { t.textContent = ''; return; }
  const s = Math.max(0, Math.ceil((pd.deadline - Date.now()) / 1000));
  t.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

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

init();
