-- Rode no SQL Editor do Supabase (uma vez).

create table if not exists public.rooms (
  code text primary key,
  host_id uuid not null,
  status text not null default 'lobby',          -- lobby | playing | finished
  state jsonb not null default '{}'::jsonb,      -- estado público da partida
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null,
  name text not null,
  seat integer not null,
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id)
);

-- Cartas ocultas e baralho. Sem policies: só a Edge Function (service role) acessa.
create table if not exists public.room_secrets (
  room_code text primary key references public.rooms(code) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_secrets enable row level security;

create policy "rooms_select" on public.rooms for select to anon, authenticated using (true);
create policy "room_players_select" on public.room_players for select to anon, authenticated using (true);

do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.room_players;
exception when duplicate_object then null; end $$;
