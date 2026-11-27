import { createClient } from 'npm:@supabase/supabase-js@2';
import { newGame, apply, tick, publicView, secretView, hydrate } from './engine.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 4 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
const clean = (n: unknown) => String(n ?? '').trim().slice(0, 16) || 'Jogador';

async function loadAll(code: string) {
  const { data: room } = await admin.from('rooms').select('*').eq('code', code).maybeSingle();
  if (!room) throw new Error('Sala não encontrada');
  const { data: sec } = await admin.from('room_secrets').select('data').eq('room_code', code).maybeSingle();
  const { data: players } = await admin.from('room_players').select('*').eq('room_code', code).order('seat');
  return { room, sec: sec?.data ?? {}, players: players ?? [] };
}

// Gravação com controle de versão (evita dois clientes sobrescreverem o mesmo estado)
async function save(room: any, pub: any, sec: any) {
  const { data, error } = await admin.from('rooms')
    .update({ state: pub, status: pub.status, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq('code', room.code).eq('version', room.version).select('code');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Estado mudou ao mesmo tempo. Tente de novo.');
  const { error: e2 } = await admin.from('room_secrets').update({ data: sec }).eq('room_code', room.code);
  if (e2) throw e2;
}

async function create(uid: string, body: any) {
  const name = clean(body.name);
  const ex = body.variant === 'inquisidor' ? 'inquisidor' : 'embaixador';
  for (let t = 0; t < 10; t++) {
    const code = genCode();
    const { error } = await admin.from('rooms').insert({ code, host_id: uid, status: 'lobby', state: { ex }, version: 0 });
    if (error) continue;
    await admin.from('room_secrets').insert({ room_code: code, data: {} });
    await admin.from('room_players').insert({ room_code: code, user_id: uid, name, seat: 0 });
    return { code };
  }
  throw new Error('Não foi possível criar a sala');
}

async function join(uid: string, body: any) {
  const code = String(body.code ?? '').toUpperCase().trim();
  const name = clean(body.name);
  const { room, players } = await loadAll(code);
  if (room.status !== 'lobby') throw new Error('A partida já começou');
  if (players.some((p: any) => p.user_id === uid)) {
    await admin.from('room_players').update({ name }).eq('room_code', code).eq('user_id', uid);
    return { code };
  }
  if (players.length >= MAX_PLAYERS) throw new Error('Sala cheia (máximo 8)');
  const { error } = await admin.from('room_players').insert({ room_code: code, user_id: uid, name, seat: players.length });
  if (error) throw error;
  return { code };
}

async function start(uid: string, code: string) {
  const { room, players } = await loadAll(code);
  if (room.host_id !== uid) throw new Error('Só o anfitrião pode iniciar');
  if (room.status !== 'lobby') throw new Error('A partida já começou');
  if (players.length < MIN_PLAYERS) throw new Error('Precisa de pelo menos 2 jogadores');
  const g = newGame(players.map((p: any) => ({ id: p.user_id, name: p.name })), room.state?.ex ?? 'embaixador');
  await save(room, publicView(g), g.sec);
  return { ok: true };
}

async function get(uid: string, code: string) {
  const { room, sec, players } = await loadAll(code);
  const out: any = {
    room: { code: room.code, status: room.status, host_id: room.host_id, version: room.version },
    lobby: players.map((p: any) => ({ user_id: p.user_id, name: p.name })),
    state: room.state,
    me: null,
  };
  if (room.status !== 'lobby') out.me = secretView(hydrate(room.state, sec), uid);
  return out;
}

async function act(uid: string, code: string, payload: any) {
  const { room, sec } = await loadAll(code);
  if (room.status !== 'playing') throw new Error('A partida não está em andamento');
  const g = hydrate(room.state, sec);
  const err = apply(g, uid, payload ?? {});
  if (err) throw new Error(err);
  await save(room, publicView(g), g.sec);
  return { ok: true };
}

async function doTick(code: string) {
  const { room, sec } = await loadAll(code);
  if (room.status !== 'playing') return { ok: false };
  const g = hydrate(room.state, sec);
  if (!tick(g)) return { ok: false };
  await save(room, publicView(g), g.sec);
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const body = await req.json();
    switch (body.action) {
      case 'create': return json(await create(user.id, body));
      case 'join': return json(await join(user.id, body));
      case 'start': return json(await start(user.id, body.code));
      case 'get': return json(await get(user.id, body.code));
      case 'act': return json(await act(user.id, body.code, body.payload));
      case 'tick': return json(await doTick(body.code));
      default: return json({ error: 'Ação desconhecida' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
