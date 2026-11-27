// Regras do Coup no servidor. Sem DOM. Toda decisão de jogo passa por aqui.
// Fluxo: uma lista de "steps" (passos) é processada até precisar de uma entrada humana,
// que fica em g.pending. Cada pending tem deadline; passou o prazo, tick() aplica o padrão.

export const TURN_MS = 120_000;

const NAMES: Record<string, string> = {
  duque: 'Duque', assassino: 'Assassino', capitao: 'Capitão',
  condessa: 'Condessa', embaixador: 'Embaixador', inquisidor: 'Inquisidor',
};

const ACTNAME: Record<string, string> = {
  renda: 'Renda (+1)', ajuda: 'Ajuda Externa (+2)', golpe: 'Golpe de Estado',
  taxas: 'Duque: Taxas (+3)', assassinar: 'Assassino: Assassinar',
  extorquir: 'Capitão: Extorquir', trocar: 'Trocar cartas', investigar: 'Inquisidor: Investigar',
};

const ACT: Record<string, any> = {
  renda: { cost: 0 },
  ajuda: { cost: 0, blockers: ['duque'] },
  golpe: { cost: 7, target: true },
  taxas: { cost: 0, role: 'duque' },
  assassinar: { cost: 3, role: 'assassino', target: true, blockers: ['condessa'] },
  extorquir: { cost: 0, role: 'capitao', target: true, blockers: ['capitao', 'EX'] },
  trocar: { cost: 0, role: 'EX' },
  investigar: { cost: 0, role: 'inquisidor', target: true },
};

function shuffle(a: any[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
const P = (g: any, id: string) => g.players.find((p: any) => p.id === id);
const aliveIds = (g: any) => g.players.filter((p: any) => p.alive).map((p: any) => p.id);
const hand = (g: any, id: string) => g.sec.hands[id] || [];
const log = (g: any, t: string, h = false) => {
  g.log.push({ t, h });
  if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
};
const setPending = (g: any, p: any) => { g.pending = { ...p, deadline: Date.now() + TURN_MS }; };

export function newGame(players: { id: string; name: string }[], ex: string) {
  const deck: string[] = [];
  for (const r of ['duque', 'assassino', 'capitao', 'condessa', ex]) for (let i = 0; i < 5; i++) deck.push(r);
  shuffle(deck);
  const g: any = {
    status: 'playing', ex, turn: 0, treasury: 50, winner: null,
    players: players.map((p, i) => ({ id: p.id, name: p.name, seat: i, coins: 0, alive: true })),
    pending: null, steps: [], log: [],
    sec: { deck, hands: {}, pool: {}, peek: {} },
  };
  for (const p of players) g.sec.hands[p.id] = [{ role: deck.pop(), dead: false }, { role: deck.pop(), dead: false }];
  log(g, 'Partida iniciada. Todos começam com 0 moedas.');
  setPending(g, { k: 'action', pid: players[0].id });
  return g;
}

// Entrada de um jogador. Retorna mensagem de erro ou null.
export function apply(g: any, uid: string, input: any): string | null {
  if (g.status !== 'playing') return 'A partida acabou';
  const pd = g.pending;
  if (!pd) return 'Aguarde';
  switch (pd.k) {
    case 'action':
      if (uid !== pd.pid) return 'Não é sua vez';
      return startAction(g, uid, input.type, input.target);
    case 'resp': {
      if (!pd.responders.includes(uid)) return 'Você não pode responder agora';
      if (uid in pd.answers) return 'Você já respondeu';
      if (pd.kind === 'challenge') pd.answers[uid] = !!input.challenge;
      else {
        const b = input.block ?? null;
        if (b !== null && !pd.blockers.includes(b)) return 'Papel inválido para bloqueio';
        pd.answers[uid] = b;
      }
      if (pd.responders.every((id: string) => id in pd.answers)) resolveResp(g);
      return null;
    }
    case 'lose': {
      if (uid !== pd.pid) return 'Não é sua vez';
      const h = hand(g, uid);
      if (!Number.isInteger(input.index) || !h[input.index] || h[input.index].dead) return 'Carta inválida';
      g.pending = null;
      killCard(g, uid, input.index);
      processSteps(g);
      return null;
    }
    case 'exchange':
      if (uid !== pd.pid) return 'Não é sua vez';
      return doExchange(g, uid, input.keep);
    case 'inv1':
      if (uid !== pd.t) return 'Não é sua vez';
      return doInv1(g, input.index);
    case 'inv2':
      if (uid !== pd.a) return 'Não é sua vez';
      doInv2(g, !!input.force);
      return null;
  }
  return 'Estado inválido';
}

// Aplica a ação padrão de quem estourou o tempo.
export function tick(g: any): boolean {
  if (g.status !== 'playing' || !g.pending) return false;
  const pd = g.pending;
  if (Date.now() < pd.deadline) return false;
  switch (pd.k) {
    case 'action': {
      const p = P(g, pd.pid);
      if (p.coins >= 10) {
        const t = aliveIds(g).find((id) => id !== pd.pid)!;
        startAction(g, pd.pid, 'golpe', t);
      } else startAction(g, pd.pid, 'renda');
      return true;
    }
    case 'resp':
      for (const id of pd.responders) if (!(id in pd.answers)) pd.answers[id] = pd.kind === 'challenge' ? false : null;
      resolveResp(g);
      return true;
    case 'lose': {
      const h = hand(g, pd.pid);
      g.pending = null;
      killCard(g, pd.pid, h.findIndex((c: any) => !c.dead));
      processSteps(g);
      return true;
    }
    case 'exchange':
      doExchange(g, pd.pid, Array.from({ length: pd.keep }, (_, i) => i));
      return true;
    case 'inv1':
      doInv1(g, hand(g, pd.t).findIndex((c: any) => !c.dead));
      return true;
    case 'inv2':
      doInv2(g, false);
      return true;
  }
  return false;
}

function startAction(g: any, pid: string, type: string, targetId?: string): string | null {
  const info = ACT[type];
  if (!info) return 'Ação inválida';
  const a = P(g, pid);
  if (a.coins >= 10 && type !== 'golpe') return 'Com 10 ou mais moedas você deve dar Golpe';
  if (a.coins < info.cost) return 'Moedas insuficientes';
  if (type === 'investigar' && g.ex !== 'inquisidor') return 'Ação indisponível nesta partida';
  let target: any = null;
  if (info.target) {
    target = P(g, targetId as string);
    if (!target || !target.alive || target.id === pid) return 'Alvo inválido';
  }
  const role = info.role === 'EX' ? g.ex : info.role || null;
  const steps: any[] = [];
  if (info.cost) steps.push({ k: 'pay', pid, amt: info.cost });
  if (role) {
    steps.push({
      k: 'claim', pid, role,
      ok: { steps: [], cancel: false },
      fail: { steps: [{ k: 'refund', pid, amt: info.cost }], cancel: true },
    });
  }
  if (info.blockers) {
    const blockers = info.blockers.map((r: string) => (r === 'EX' ? g.ex : r));
    const cands = type === 'ajuda' ? aliveIds(g).filter((x) => x !== pid) : [target.id];
    steps.push({ k: 'block', pid, type, target: target ? target.id : null, blockers, cands });
  }
  steps.push({ k: 'effect', type, pid, target: target ? target.id : null });
  g.pending = null;
  g.steps = steps;
  log(g, `${a.name} usa ${ACTNAME[type]}${target ? ' contra ' + target.name : ''}.`, false);
  processSteps(g);
  return null;
}

function processSteps(g: any) {
  while (g.status === 'playing' && !g.pending) {
    if (g.steps.length === 0) { endTurn(g); return; }
    const s = g.steps.shift();
    switch (s.k) {
      case 'pay': P(g, s.pid).coins -= s.amt; g.treasury += s.amt; break;
      case 'refund': {
        const p = P(g, s.pid);
        p.coins += s.amt; g.treasury -= s.amt;
        log(g, `${p.name} recebe de volta ${s.amt} moeda(s).`);
        break;
      }
      case 'blocked': log(g, 'A ação foi bloqueada.'); break;
      case 'claim': {
        const resp = aliveIds(g).filter((x) => x !== s.pid);
        if (resp.length === 0) { finishChallenge(g, s, null); break; }
        log(g, `${P(g, s.pid).name} afirma ser ${NAMES[s.role]}.`);
        setPending(g, {
          k: 'resp', kind: 'challenge', claimer: s.pid, role: s.role,
          responders: resp, answers: {}, ok: s.ok, fail: s.fail,
        });
        break;
      }
      case 'block': {
        const resp = s.cands.filter((id: string) => P(g, id)?.alive && id !== s.pid);
        if (resp.length === 0) break;
        setPending(g, {
          k: 'resp', kind: 'block', responders: resp, answers: {},
          actor: s.pid, type: s.type, target: s.target, blockers: s.blockers,
        });
        break;
      }
      case 'effect': effect(g, s); break;
      case 'lose': {
        const p = P(g, s.pid);
        if (!p || !p.alive) break;
        const h = hand(g, s.pid);
        const idxs = h.map((_: any, i: number) => i).filter((i: number) => !h[i].dead);
        if (idxs.length === 0) break;
        if (idxs.length === 1) killCard(g, s.pid, idxs[0]);
        else setPending(g, { k: 'lose', pid: s.pid });
        break;
      }
    }
  }
}

function resolveResp(g: any) {
  const pd = g.pending;
  g.pending = null;
  if (pd.kind === 'challenge') {
    const chId = pd.responders.find((id: string) => pd.answers[id] === true) || null;
    finishChallenge(g, pd, chId);
  } else {
    const bl = pd.responders.find((id: string) => pd.answers[id]);
    if (bl) {
      const role = pd.answers[bl];
      log(g, `${P(g, bl).name} afirma ser ${NAMES[role]} e bloqueia.`);
      g.steps.unshift({
        k: 'claim', pid: bl, role,
        ok: { steps: [{ k: 'blocked' }], cancel: true },
        fail: { steps: [], cancel: false },
      });
    }
  }
  processSteps(g);
}

// c: {claimer|pid, role, ok, fail}. chId: quem desafiou (ou null).
function finishChallenge(g: any, c: any, chId: string | null) {
  const claimer = c.claimer ?? c.pid;
  let prefix: any[] = [];
  let branch = c.ok;
  if (chId) {
    const h = hand(g, claimer);
    const idx = h.findIndex((x: any) => !x.dead && x.role === c.role);
    if (idx >= 0) {
      g.sec.deck.push(h[idx].role);
      shuffle(g.sec.deck);
      h[idx] = { role: g.sec.deck.pop(), dead: false };
      log(g, `${P(g, claimer).name} mostra ${NAMES[c.role]}: era verdade. ${P(g, chId).name} perde uma influência.`);
      prefix = [{ k: 'lose', pid: chId }];
    } else {
      log(g, `${P(g, claimer).name} não tinha ${NAMES[c.role]}! Perde o desafio.`);
      prefix = [{ k: 'lose', pid: claimer }];
      branch = c.fail;
    }
  }
  const ns = [...prefix, ...branch.steps];
  g.steps = branch.cancel ? ns : [...ns, ...g.steps];
}

function effect(g: any, s: any) {
  const a = P(g, s.pid);
  const t = s.target ? P(g, s.target) : null;
  switch (s.type) {
    case 'renda': gain(g, a, 1); break;
    case 'ajuda': gain(g, a, 2); break;
    case 'taxas': gain(g, a, 3); break;
    case 'extorquir': {
      const n = Math.min(2, t.coins);
      t.coins -= n; a.coins += n;
      log(g, `${a.name} rouba ${n} moeda(s) de ${t.name}.`);
      break;
    }
    case 'assassinar':
      if (t.alive) { log(g, `${t.name} é assassinado!`); g.steps.unshift({ k: 'lose', pid: t.id }); }
      break;
    case 'golpe':
      if (t.alive) { log(g, `${a.name} dá um Golpe em ${t.name}!`); g.steps.unshift({ k: 'lose', pid: t.id }); }
      break;
    case 'trocar': startExchange(g, a); break;
    case 'investigar':
      if (t.alive && hand(g, t.id).some((c: any) => !c.dead)) {
        log(g, `${a.name} investiga ${t.name}.`);
        setPending(g, { k: 'inv1', a: a.id, t: t.id });
      }
      break;
  }
}

function gain(g: any, p: any, n: number) {
  const k = Math.min(n, g.treasury);
  p.coins += k; g.treasury -= k;
  log(g, `${p.name} recebe ${k} moeda(s) do Tesouro.`);
}

function killCard(g: any, pid: string, idx: number) {
  const p = P(g, pid);
  const h = hand(g, pid);
  h[idx].dead = true;
  log(g, `${p.name} perde ${NAMES[h[idx].role]}.`);
  if (!h.some((c: any) => !c.dead)) {
    p.alive = false;
    g.treasury += p.coins;
    p.coins = 0;
    log(g, `${p.name} está fora do jogo!`);
  }
  const al = aliveIds(g);
  if (al.length <= 1) {
    g.status = 'finished';
    g.winner = al[0] ?? null;
    g.pending = null;
    g.steps = [];
    log(g, `${g.winner ? P(g, g.winner).name : 'Ninguém'} venceu a partida!`, true);
  }
}

function startExchange(g: any, a: any) {
  const alive = hand(g, a.id).filter((c: any) => !c.dead);
  const draws = [g.sec.deck.pop(), g.sec.deck.pop()].filter((x) => x !== undefined);
  g.sec.pool[a.id] = [...alive.map((c: any) => c.role), ...draws];
  setPending(g, { k: 'exchange', pid: a.id, keep: alive.length });
}

function doExchange(g: any, uid: string, keep: any): string | null {
  const pd = g.pending;
  const pool: string[] = g.sec.pool[uid] || [];
  if (!Array.isArray(keep) || keep.length !== pd.keep || new Set(keep).size !== keep.length ||
      keep.some((i: any) => !Number.isInteger(i) || i < 0 || i >= pool.length)) {
    return `Escolha ${pd.keep} carta(s) válida(s)`;
  }
  const newRoles = keep.map((i: number) => pool[i]);
  const back = pool.filter((_, i) => !keep.includes(i));
  hand(g, uid).filter((c: any) => !c.dead).forEach((c: any, i: number) => { c.role = newRoles[i]; });
  g.sec.deck.push(...back);
  shuffle(g.sec.deck);
  delete g.sec.pool[uid];
  g.pending = null;
  log(g, `${P(g, uid).name} trocou cartas com a Corte.`);
  processSteps(g);
  return null;
}

function doInv1(g: any, index: number): string | null {
  const pd = g.pending;
  const h = hand(g, pd.t);
  if (!Number.isInteger(index) || !h[index] || h[index].dead) return 'Carta inválida';
  g.sec.peek[pd.a] = h[index].role;
  setPending(g, { k: 'inv2', a: pd.a, t: pd.t, index });
  return null;
}

function doInv2(g: any, force: boolean) {
  const pd = g.pending;
  const tgt = P(g, pd.t), act = P(g, pd.a);
  if (force) {
    const h = hand(g, pd.t);
    g.sec.deck.push(h[pd.index].role);
    shuffle(g.sec.deck);
    h[pd.index] = { role: g.sec.deck.pop(), dead: false };
    log(g, `${tgt.name} é forçado a trocar a carta revelada.`);
  } else {
    log(g, `${act.name} investigou ${tgt.name} e não forçou troca.`);
  }
  delete g.sec.peek[pd.a];
  g.pending = null;
  processSteps(g);
}

function endTurn(g: any) {
  if (g.status !== 'playing') return;
  const n = g.players.length;
  let i = g.turn;
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n;
    if (g.players[i].alive) break;
  }
  g.turn = i;
  setPending(g, { k: 'action', pid: g.players[i].id });
}

// Estado público (vai para rooms.state). Nunca contém cartas ocultas.
export function publicView(g: any) {
  return {
    status: g.status, ex: g.ex, turn: g.turn, treasury: g.treasury, winner: g.winner,
    players: g.players.map((p: any) => ({
      ...p,
      cards: g.sec.hands[p.id].map((c: any) => (c.dead ? { role: c.role, dead: true } : { role: null, dead: false })),
    })),
    pending: g.pending, steps: g.steps, log: g.log.slice(-80), deckCount: g.sec.deck.length,
  };
}

// Parte privada de um jogador: só as próprias cartas ocultas e o que ele precisa ver.
export function secretView(g: any, uid: string) {
  return {
    hand: hand(g, uid).map((c: any, i: number) => ({ i, role: c.role, dead: c.dead })).filter((c: any) => !c.dead).map(({ i, role }: any) => ({ i, role })),
    pool: g.sec.pool[uid] ?? null,
    peek: g.sec.peek[uid] ?? null,
  };
}

// Reconstrói o objeto de jogo a partir do que está salvo no banco.
export function hydrate(state: any, sec: any) {
  return {
    ...state,
    sec: { deck: sec.deck ?? [], hands: sec.hands ?? {}, pool: sec.pool ?? {}, peek: sec.peek ?? {} },
    steps: state.steps ?? [],
    log: state.log ?? [],
  };
}
