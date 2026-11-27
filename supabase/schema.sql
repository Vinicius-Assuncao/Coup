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

drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms for select to anon, authenticated using (true);
drop policy if exists "room_players_select" on public.room_players;
create policy "room_players_select" on public.room_players for select to anon, authenticated using (true);

-- Garante que as duas tabelas publiquem eventos para o Supabase Realtime.
-- Pode ser executado novamente sem erro.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_players'
  ) then
    execute 'alter publication supabase_realtime add table public.room_players';
  end if;
end $$;
