-- Peregovorchik: базовая схема (профили, сценарии, сессии, сообщения, результаты)

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth_user_id = auth.uid());

-- Профиль создаётся автоматически при регистрации через триггер на auth.users,
-- поэтому insert-политика не нужна — вставляет только service role в триггере.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (auth_user_id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Сценарии переговоров живут как декларативные TS-константы в коде
-- (src/lib/scenarios/) и не дублируются в БД: они не меняются пользователем
-- и деплоятся вместе с приложением. Сессия ссылается на сценарий по его
-- стабильному slug, а не по foreign key на несуществующую таблицу.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario_slug text not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.sessions enable row level security;

create policy "sessions_all_own"
  on public.sessions for all
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Реплики диалога — история для контекста LLM и последующего разбора.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'opponent')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_id_idx on public.messages (session_id, created_at);

alter table public.messages enable row level security;

create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using (
    session_id in (
      select id from public.sessions
      where user_id = (select id from public.profiles where auth_user_id = auth.uid())
    )
  );

create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (
    session_id in (
      select id from public.sessions
      where user_id = (select id from public.profiles where auth_user_id = auth.uid())
    )
  );

-- Итог сессии: оценка LLM после завершения диалога.
create table if not exists public.session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  outcome text not null check (outcome in ('win', 'draw', 'lose')),
  score integer not null check (score >= 0 and score <= 100),
  criteria_breakdown jsonb not null,   -- [{ criterion, score, comment }]
  feedback_text text not null,
  created_at timestamptz not null default now()
);

alter table public.session_results enable row level security;

create policy "session_results_select_own"
  on public.session_results for select
  to authenticated
  using (
    session_id in (
      select id from public.sessions
      where user_id = (select id from public.profiles where auth_user_id = auth.uid())
    )
  );

create policy "session_results_insert_own"
  on public.session_results for insert
  to authenticated
  with check (
    session_id in (
      select id from public.sessions
      where user_id = (select id from public.profiles where auth_user_id = auth.uid())
    )
  );
