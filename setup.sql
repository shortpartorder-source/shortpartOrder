-- ============================================================
--  Siddheshwar Automobile — Short / Damaged Parts Tracker
--  Supabase setup  ·  v3.0 (multi-user, admin, live sync, app lock)
--
--  Run in: Supabase → SQL Editor → New Query → paste ALL → Run
--
--  SAFE ON A LIVE DATABASE:
--    • Only ADDS tables / columns / functions. Nothing is deleted.
--    • Safe to run twice (idempotent).
--    • Every existing short/damaged order is given to "test123",
--      and admin sees everything. New users start with an empty history.
--
--  LOGINS AFTER RUNNING:  admin / admin123   (sees everything)
--                         test123 / pass123  (sees the existing orders)
--  Change both passwords in Admin → Users → Password.
-- ============================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ────────────────────────────────────────────────────────────
-- 1. ORIGINAL TABLES (unchanged)
-- ────────────────────────────────────────────────────────────
create table if not exists sheets (
  id bigint generated always as identity primary key,
  name text not null,
  part_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists parts (
  id bigint generated always as identity primary key,
  sheet_id bigint references sheets(id) on delete cascade,
  part_code text not null,
  alt_code text default '',
  description text default '',
  price numeric default 0,
  hsn_no text default '',
  is_blocked text default 'N',
  created_at timestamptz default now()
);
create index if not exists idx_parts_sheet_id on parts(sheet_id);
create index if not exists idx_parts_sheet_id_id on parts(sheet_id, id);
create index if not exists idx_parts_part_code on parts(part_code);
create index if not exists idx_parts_id on parts(id);
create index if not exists idx_parts_sheet_code on parts(sheet_id, upper(part_code));

create table if not exists short_orders (
  id bigint generated always as identity primary key,
  invoice_no text not null,
  invoice_date date not null,
  sheet_id bigint,
  sheet_name text default '',
  parts jsonb default '[]',
  total_actual_mrp numeric default 0,
  total_printed_mrp numeric default 0,
  total_invoice_mrp numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_short_orders_invoice_no on short_orders(invoice_no);
create index if not exists idx_short_orders_invoice_date on short_orders(invoice_date);
create index if not exists idx_short_orders_created_at on short_orders(created_at);

alter table sheets enable row level security;
alter table parts enable row level security;
alter table short_orders enable row level security;
drop policy if exists "Allow all" on sheets;
drop policy if exists "Allow all" on parts;
drop policy if exists "Allow all" on short_orders;
create policy "Allow all" on sheets for all using (true) with check (true);
create policy "Allow all" on parts for all using (true) with check (true);
create policy "Allow all" on short_orders for all using (true) with check (true);

-- ────────────────────────────────────────────────────────────
-- 2. USERS, SESSIONS, ENCRYPTION KEY
--    Locked down: the public key cannot read these tables.
-- ────────────────────────────────────────────────────────────
create table if not exists app_users (
  id bigint generated always as identity primary key,
  username text not null,
  password_hash text not null,
  password_enc bytea,
  role text not null default 'user' check (role in ('admin','user')),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table app_users add column if not exists password_enc bytea;
create unique index if not exists idx_app_users_username_lower on app_users(lower(username));
alter table app_users enable row level security;
revoke all on app_users from anon, authenticated;

create table if not exists app_sessions (
  token text primary key,
  username text not null,
  device_id text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);
create index if not exists idx_app_sessions_username on app_sessions(lower(username));
alter table app_sessions enable row level security;
revoke all on app_sessions from anon, authenticated;

create table if not exists app_secrets (
  id int primary key check (id = 1),
  enc_key text not null
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;
insert into app_secrets (id, enc_key)
select 1, encode(extensions.gen_random_bytes(32), 'hex')
where not exists (select 1 from app_secrets);

create or replace function app_secret_key() returns text
language sql security definer set search_path = public as $$
  select enc_key from app_secrets where id = 1;
$$;
revoke execute on function app_secret_key() from public, anon, authenticated;

create table if not exists app_login_failures (
  username text not null,
  day date not null,
  attempts int not null default 0,
  primary key (username, day)
);
alter table app_login_failures enable row level security;
revoke all on app_login_failures from anon, authenticated;

-- Seed 1: admin / admin123 — sees everything
insert into app_users (username, password_hash, role, password_enc)
select 'admin', extensions.crypt('admin123', extensions.gen_salt('bf')), 'admin',
       extensions.pgp_sym_encrypt('admin123', app_secret_key())
where not exists (select 1 from app_users);

-- Seed 2: test123 / pass123 — normal user who OWNS all orders made before the upgrade.
-- (If a test123 user already exists, its password is left as the admin set it.)
insert into app_users (username, password_hash, role, password_enc)
select 'test123', extensions.crypt('pass123', extensions.gen_salt('bf')), 'user',
       extensions.pgp_sym_encrypt('pass123', app_secret_key())
where not exists (select 1 from app_users where lower(username) = 'test123');

-- ────────────────────────────────────────────────────────────
-- 3. ORDER OWNER
--    Orders that existed BEFORE the upgrade belong to test123 (admin sees
--    them too, because admin sees everything). New users start empty.
--    Runs once (remembered in app_owner_migration).
-- ────────────────────────────────────────────────────────────
alter table short_orders add column if not exists created_by text;
create index if not exists idx_short_orders_created_by on short_orders(created_by);

create table if not exists app_owner_migration (id int primary key check (id = 1), done_at timestamptz default now());
alter table app_owner_migration enable row level security;
revoke all on app_owner_migration from anon, authenticated;

do $$
declare v_owner text; v_admin text; v_upgrade timestamptz;
begin
  if exists (select 1 from app_owner_migration) then return; end if;
  select username into v_owner from app_users where lower(username) = 'test123';
  select username, created_at into v_admin, v_upgrade from app_users where role = 'admin' order by id limit 1;
  -- never had an owner
  update short_orders set created_by = v_owner where created_by is null or created_by = '';
  -- databases where v3.0 already gave the old orders to admin: move only the ones
  -- made before the upgrade; anything admin created afterwards stays with admin
  update short_orders set created_by = v_owner
   where created_by = v_admin and created_at < v_upgrade;
  insert into app_owner_migration (id) values (1);
end $$;

-- Safety net: an order saved by an older copy of the app (no owner) goes to test123
create or replace function short_orders_default_owner() returns trigger as $$
begin
  if new.created_by is null or new.created_by = '' then
    new.created_by := coalesce(
      (select username from app_users where lower(username) = 'test123'),
      (select username from app_users where role = 'admin' order by id limit 1));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_short_orders_default_owner on short_orders;
create trigger trg_short_orders_default_owner
  before insert on short_orders
  for each row execute function short_orders_default_owner();

-- ────────────────────────────────────────────────────────────
-- 4. ACTIVITY LOG (30 days) + DEVICES + APP LOCK
--    Everyone can READ (needed for live updates); writes only
--    through the functions below.
-- ────────────────────────────────────────────────────────────
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  entity_type text not null,         -- order | sheet | part | user | device | settings
  action text not null,              -- created | updated | deleted | restored | login | ...
  entity_id text,
  entity_name text,
  details text,
  before_data jsonb,
  after_data jsonb,
  user_name text,
  device_id text,
  device_name text
);
create index if not exists idx_activity_log_created_at on activity_log(created_at desc);
create index if not exists idx_activity_log_entity on activity_log(entity_type, entity_id);
alter table activity_log enable row level security;
drop policy if exists "Read log" on activity_log;
create policy "Read log" on activity_log for select using (true);
revoke insert, update, delete on activity_log from anon, authenticated;
grant select on activity_log to anon, authenticated;

create or replace function prune_activity_log() returns trigger as $$
begin
  delete from activity_log where created_at < now() - interval '30 days';
  return null;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_prune_activity_log on activity_log;
create trigger trg_prune_activity_log
  after insert on activity_log
  for each statement execute function prune_activity_log();

create table if not exists device_sessions (
  device_id text primary key,
  user_name text,
  device_label text,          -- detected, e.g. "Windows 11 · Chrome"
  custom_name text,           -- given by admin, e.g. "Counter PC"
  device_type text,           -- desktop | phone | tablet
  user_agent text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  revoked boolean not null default false,
  revoked_at timestamptz
);
alter table device_sessions add column if not exists custom_name text;
alter table device_sessions add column if not exists device_type text;
alter table device_sessions enable row level security;
drop policy if exists "Read devices" on device_sessions;
create policy "Read devices" on device_sessions for select using (true);
revoke insert, update, delete on device_sessions from anon, authenticated;
grant select on device_sessions to anon, authenticated;

create table if not exists app_settings (
  id int primary key check (id = 1),
  locked boolean not null default false,
  locked_by text,
  locked_at timestamptz,
  updated_at timestamptz default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;
alter table app_settings enable row level security;
drop policy if exists "Read settings" on app_settings;
create policy "Read settings" on app_settings for select using (true);
revoke insert, update, delete on app_settings from anon, authenticated;
grant select on app_settings to anon, authenticated;

-- Live updates (Supabase Realtime)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['short_orders','sheets','activity_log','device_sessions','app_settings'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 5. INTERNAL HELPERS
-- ────────────────────────────────────────────────────────────
-- Writes a log row (used inside admin functions). Not callable by the app.
create or replace function app_log_internal(p_user text, p_type text, p_action text,
                                            p_id text, p_name text, p_details text)
returns void language sql security definer set search_path = public as $$
  insert into activity_log(entity_type, action, entity_id, entity_name, details, user_name)
  values (p_type, p_action, p_id, p_name, p_details, p_user);
$$;
revoke execute on function app_log_internal(text,text,text,text,text,text) from public, anon, authenticated;

-- Username for a valid session token, else an error
create or replace function app_require_session(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select a.username into v
    from app_sessions s join app_users a on lower(a.username) = lower(s.username)
   where s.token = p_token and a.active;
  if v is null then raise exception 'Your login has expired — please sign in again'; end if;
  return v;
end $$;

create or replace function app_require_admin(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select a.username into v
    from app_sessions s join app_users a on lower(a.username) = lower(s.username)
   where s.token = p_token and a.active and a.role = 'admin';
  if v is null then raise exception 'Only an admin can do this'; end if;
  return v;
end $$;

-- ────────────────────────────────────────────────────────────
-- 6. LOGIN / SESSION
-- ────────────────────────────────────────────────────────────
-- status: ok | no_user | disabled | wrong_password
create or replace function app_login2(p_username text, p_password text, p_device_id text)
returns table(status text, session_token text, user_name text, user_role text, failed_today int)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  u app_users%rowtype;
  t text;
  f int;
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into u from app_users a where lower(a.username) = lower(trim(p_username));
  if not found then
    return query select 'no_user'::text, null::text, null::text, null::text, 0;
    return;
  end if;
  if not u.active then
    return query select 'disabled'::text, null::text, null::text, null::text, 0;
    return;
  end if;
  if u.password_hash <> extensions.crypt(p_password, u.password_hash) then
    delete from app_login_failures lf where lf.day < v_day - 7;
    insert into app_login_failures as lf (username, day, attempts)
    values (lower(u.username), v_day, 1)
    on conflict (username, day) do update set attempts = lf.attempts + 1
    returning lf.attempts into f;
    return query select 'wrong_password'::text, null::text, null::text, null::text, f;
    return;
  end if;
  delete from app_login_failures lf where lf.username = lower(u.username);
  delete from app_sessions s where s.last_seen_at < now() - interval '30 days';
  if u.password_enc is null then
    update app_users a set password_enc = extensions.pgp_sym_encrypt(p_password, app_secret_key()) where a.id = u.id;
  end if;
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into app_sessions(token, username, device_id) values (t, u.username, p_device_id);
  return query select 'ok'::text, t, u.username, u.role, 0;
end $$;

create or replace function app_session_check(p_token text)
returns table(user_name text, user_role text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update app_sessions s set last_seen_at = now() where s.token = p_token;
  return query
    select a.username, a.role
      from app_sessions s join app_users a on lower(a.username) = lower(s.username)
     where s.token = p_token and a.active;
end $$;

create or replace function app_logout(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from app_sessions where token = p_token;
$$;

-- Any user: change own password (needs current password)
create or replace function app_change_own_password(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me text; h text;
begin
  me := app_require_session(p_token);
  select password_hash into h from app_users where username = me;
  if h <> extensions.crypt(p_old, h) then raise exception 'Current password is incorrect'; end if;
  if length(coalesce(p_new,'')) < 4 then raise exception 'Password must be at least 4 characters'; end if;
  update app_users set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf')),
                       password_enc  = extensions.pgp_sym_encrypt(p_new, app_secret_key()),
                       updated_at = now()
   where username = me;
  delete from app_sessions where lower(username) = lower(me) and token <> p_token;
  perform app_log_internal(me, 'user', 'password', me, me, 'Changed own password');
end $$;

-- ────────────────────────────────────────────────────────────
-- 7. ADMIN — USERS
-- ────────────────────────────────────────────────────────────
drop function if exists app_list_users(text);
create or replace function app_list_users(p_token text)
returns table(id bigint, username text, role text, active boolean, created_at timestamptz,
              has_password boolean, last_seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform app_require_admin(p_token);
  return query
    select a.id, a.username, a.role, a.active, a.created_at, a.password_enc is not null,
           (select max(s.last_seen_at) from app_sessions s where lower(s.username) = lower(a.username))
      from app_users a order by a.id;
end $$;

create or replace function app_create_user(p_token text, p_username text, p_password text, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me text; v_name text := trim(p_username);
begin
  me := app_require_admin(p_token);
  if v_name !~ '^[A-Za-z0-9._@-]{3,30}$' then raise exception 'Username: 3-30 letters/numbers (. _ - @ allowed, no spaces)'; end if;
  if length(coalesce(p_password,'')) < 4 then raise exception 'Password must be at least 4 characters'; end if;
  if p_role not in ('admin','user') then raise exception 'Invalid role'; end if;
  if exists (select 1 from app_users a where lower(a.username) = lower(v_name)) then
    raise exception 'Username "%" already exists', v_name;
  end if;
  insert into app_users(username, password_hash, role, password_enc)
  values (v_name, extensions.crypt(p_password, extensions.gen_salt('bf')), p_role,
          extensions.pgp_sym_encrypt(p_password, app_secret_key()));
  perform app_log_internal(me, 'user', 'created', v_name, v_name, 'Added ' || p_role || ' "' || v_name || '"');
end $$;

create or replace function app_set_password(p_token text, p_username text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me text;
begin
  me := app_require_admin(p_token);
  if length(coalesce(p_password,'')) < 4 then raise exception 'Password must be at least 4 characters'; end if;
  update app_users set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')),
                       password_enc  = extensions.pgp_sym_encrypt(p_password, app_secret_key()),
                       updated_at = now()
   where lower(username) = lower(p_username);
  if not found then raise exception 'User not found'; end if;
  delete from app_sessions where lower(username) = lower(p_username) and token <> p_token;
  perform app_log_internal(me, 'user', 'password', p_username, p_username, 'Changed password of "' || p_username || '"');
end $$;

-- Admin sees any user's current password (including their own)
create or replace function app_get_password(p_token text, p_username text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v bytea;
begin
  perform app_require_admin(p_token);
  select password_enc into v from app_users where lower(username) = lower(p_username);
  if not found then raise exception 'User not found'; end if;
  if v is null then return null; end if;
  return extensions.pgp_sym_decrypt(v, app_secret_key());
end $$;

create or replace function app_set_active(p_token text, p_username text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := app_require_admin(p_token);
  if lower(me) = lower(p_username) and not p_active then raise exception 'You cannot disable your own account'; end if;
  update app_users set active = p_active, updated_at = now() where lower(username) = lower(p_username);
  if not found then raise exception 'User not found'; end if;
  if not p_active then delete from app_sessions where lower(username) = lower(p_username); end if;
  perform app_log_internal(me, 'user', case when p_active then 'enabled' else 'disabled' end,
                           p_username, p_username,
                           case when p_active then 'Enabled "' else 'Disabled "' end || p_username || '"');
end $$;

create or replace function app_set_role(p_token text, p_username text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := app_require_admin(p_token);
  if p_role not in ('admin','user') then raise exception 'Invalid role'; end if;
  if lower(me) = lower(p_username) and p_role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  update app_users set role = p_role, updated_at = now() where lower(username) = lower(p_username);
  if not found then raise exception 'User not found'; end if;
  perform app_log_internal(me, 'user', 'role', p_username, p_username, 'Made "' || p_username || '" ' || p_role);
end $$;

-- Rename keeps all of that user's orders, sessions and devices attached
create or replace function app_rename_user(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare me text; v_old text; v_new text := trim(p_new);
begin
  me := app_require_admin(p_token);
  if v_new !~ '^[A-Za-z0-9._@-]{3,30}$' then raise exception 'Username: 3-30 letters/numbers (. _ - @ allowed, no spaces)'; end if;
  select username into v_old from app_users where lower(username) = lower(p_old);
  if v_old is null then raise exception 'User not found'; end if;
  if lower(v_old) <> lower(v_new) and exists (select 1 from app_users where lower(username) = lower(v_new)) then
    raise exception 'Username "%" already exists', v_new;
  end if;
  update app_users set username = v_new, updated_at = now() where username = v_old;
  update short_orders set created_by = v_new where created_by = v_old;
  update app_sessions set username = v_new where username = v_old;
  update device_sessions set user_name = v_new where user_name = v_old;
  perform app_log_internal(case when lower(me) = lower(v_old) then v_new else me end,
                           'user', 'renamed', v_new, v_new, 'Renamed "' || v_old || '" to "' || v_new || '"');
end $$;

-- Remove a user: login, sessions, devices go; ORDERS ARE KEPT as "<name> (removed)"
create or replace function app_delete_user(p_token text, p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare me text; v_name text;
begin
  me := app_require_admin(p_token);
  select username into v_name from app_users where lower(username) = lower(p_username);
  if v_name is null then raise exception 'User not found'; end if;
  if lower(v_name) = lower(me) then raise exception 'You cannot remove your own account'; end if;
  update short_orders set created_by = v_name || ' (removed)' where created_by = v_name;
  delete from app_sessions where lower(username) = lower(v_name);
  update device_sessions set revoked = true, revoked_at = now() where user_name = v_name and not revoked;
  delete from app_users where username = v_name;
  perform app_log_internal(me, 'user', 'removed', v_name, v_name, 'Removed user "' || v_name || '" (orders kept)');
end $$;

-- ────────────────────────────────────────────────────────────
-- 8. APP LOCK
-- ────────────────────────────────────────────────────────────
create or replace function app_set_lock(p_token text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := app_require_admin(p_token);
  update app_settings
     set locked = p_locked,
         locked_by = case when p_locked then me else null end,
         locked_at = case when p_locked then now() else null end,
         updated_at = now()
   where id = 1;
  perform app_log_internal(me, 'settings', case when p_locked then 'locked' else 'unlocked' end,
                           'lock', 'App lock', case when p_locked then 'Locked the app' else 'Unlocked the app' end);
end $$;

-- ────────────────────────────────────────────────────────────
-- 9. ACTIVITY LOG + DEVICES (called by the app)
-- ────────────────────────────────────────────────────────────
create or replace function app_log(p_token text, p_device_id text, p_type text, p_action text,
                                   p_entity_id text, p_entity_name text, p_details text,
                                   p_before jsonb, p_after jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me text; dn text;
begin
  select a.username into me
    from app_sessions s join app_users a on lower(a.username) = lower(s.username)
   where s.token = p_token and a.active;
  if me is null then return; end if;
  -- the app may only write ordinary entries; user/settings entries come from the functions above
  if p_type not in ('order','sheet','part','device') then return; end if;
  select coalesce(nullif(d.custom_name,''), d.device_label) into dn from device_sessions d where d.device_id = p_device_id;
  insert into activity_log(entity_type, action, entity_id, entity_name, details, before_data, after_data,
                           user_name, device_id, device_name)
  values (p_type, p_action, p_entity_id, left(p_entity_name, 200), left(p_details, 500), p_before, p_after,
          me, p_device_id, dn);
end $$;

create or replace function app_device_heartbeat(p_token text, p_device_id text, p_label text,
                                                p_type text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  select a.username into me
    from app_sessions s join app_users a on lower(a.username) = lower(s.username)
   where s.token = p_token and a.active;
  if me is null or coalesce(p_device_id,'') = '' then return; end if;
  insert into device_sessions as d (device_id, user_name, device_label, device_type, user_agent, last_seen_at, revoked, revoked_at)
  values (p_device_id, me, left(p_label,120), p_type, left(p_ua,400), now(), false, null)
  on conflict (device_id) do update
     set user_name = excluded.user_name,
         device_label = excluded.device_label,
         device_type = excluded.device_type,
         user_agent = excluded.user_agent,
         last_seen_at = now(),
         revoked = false,
         revoked_at = null;
end $$;

create or replace function app_device_rename(p_token text, p_device_id text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := app_require_admin(p_token);
  update device_sessions set custom_name = nullif(left(trim(p_name),60),'') where device_id = p_device_id;
  if not found then raise exception 'Device not found'; end if;
  insert into activity_log(entity_type, action, entity_id, entity_name, details, user_name)
  values ('device', 'renamed', p_device_id, coalesce(nullif(trim(p_name),''),'(no name)'),
          'Named device "' || coalesce(nullif(trim(p_name),''),'(no name)') || '"', me);
end $$;

-- Sign a device out (its login token is deleted; the device reacts instantly)
create or replace function app_device_revoke(p_token text, p_device_id text)
returns void language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := app_require_admin(p_token);
  delete from app_sessions where device_id = p_device_id and token <> p_token;
  update device_sessions set revoked = true, revoked_at = now() where device_id = p_device_id;
  insert into activity_log(entity_type, action, entity_id, entity_name, details, user_name)
  select 'device', 'signed_out', p_device_id, coalesce(nullif(d.custom_name,''), d.device_label),
         'Signed out device', me from device_sessions d where d.device_id = p_device_id;
end $$;

-- ────────────────────────────────────────────────────────────
-- 10. SHEETS + STORAGE
-- ────────────────────────────────────────────────────────────
-- Exact part count (safe when two devices add parts at once)
create or replace function app_sheet_recount(p_sheet_id bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from parts where sheet_id = p_sheet_id;
  update sheets set part_count = n where id = p_sheet_id;
  return n;
end $$;

-- Fast catalogue download: one chunk = up to 20,000 parts as compact arrays
-- [id, part_code, alt_code, description, price, hsn_no, is_blocked]. The app asks
-- for several chunks at once, so 66k parts arrive in ~4 parallel requests
-- instead of 67 one-after-another pages. Same read access as the parts table.
create or replace function app_sheet_parts(p_sheet_id bigint, p_offset int default 0, p_limit int default 20000) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_array(id, part_code, alt_code, description, price, hsn_no, is_blocked) order by id), '[]'::json)
  from (select id, part_code, coalesce(alt_code,'') alt_code, coalesce(description,'') description,
               coalesce(price,0) price, coalesce(hsn_no,'') hsn_no, coalesce(is_blocked,'N') is_blocked
          from parts where sheet_id = p_sheet_id
          order by id offset greatest(p_offset,0) limit least(greatest(p_limit,1), 20000)) x
$$;
grant execute on function app_sheet_parts(bigint, int, int) to anon, authenticated;

create or replace function app_storage_stats(p_token text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform app_require_admin(p_token);
  return json_build_object(
    'db_bytes',     pg_database_size(current_database()),
    'orders',       (select count(*) from short_orders),
    'orders_bytes', pg_total_relation_size('short_orders'),
    'parts',        (select count(*) from parts),
    'parts_bytes',  pg_total_relation_size('parts'),
    'sheets',       (select count(*) from sheets),
    'log',          (select count(*) from activity_log),
    'log_bytes',    pg_total_relation_size('activity_log'),
    'users',        (select count(*) from app_users),
    'devices',      (select count(*) from device_sessions)
  );
end $$;

-- ────────────────────────────────────────────────────────────
-- 11. PERMISSIONS for the app (public key)
-- ────────────────────────────────────────────────────────────
grant execute on function app_login2(text,text,text)                  to anon, authenticated;
grant execute on function app_session_check(text)                     to anon, authenticated;
grant execute on function app_logout(text)                            to anon, authenticated;
grant execute on function app_change_own_password(text,text,text)     to anon, authenticated;
grant execute on function app_require_session(text)                   to anon, authenticated;
grant execute on function app_require_admin(text)                     to anon, authenticated;
grant execute on function app_list_users(text)                        to anon, authenticated;
grant execute on function app_create_user(text,text,text,text)        to anon, authenticated;
grant execute on function app_set_password(text,text,text)           to anon, authenticated;
grant execute on function app_get_password(text,text)                 to anon, authenticated;
grant execute on function app_set_active(text,text,boolean)           to anon, authenticated;
grant execute on function app_set_role(text,text,text)                to anon, authenticated;
grant execute on function app_rename_user(text,text,text)             to anon, authenticated;
grant execute on function app_delete_user(text,text)                  to anon, authenticated;
grant execute on function app_set_lock(text,boolean)                  to anon, authenticated;
grant execute on function app_log(text,text,text,text,text,text,text,jsonb,jsonb) to anon, authenticated;
grant execute on function app_device_heartbeat(text,text,text,text,text) to anon, authenticated;
grant execute on function app_device_rename(text,text,text)           to anon, authenticated;
grant execute on function app_device_revoke(text,text)                to anon, authenticated;
grant execute on function app_sheet_recount(bigint)                   to anon, authenticated;
grant execute on function app_storage_stats(text)                     to anon, authenticated;

-- Increase timeout for large Excel uploads
alter role authenticator set statement_timeout = '120s';

-- Make the new functions visible to the API immediately
notify pgrst, 'reload schema';

select 'Setup complete! Logins: admin / admin123 (all data) · test123 / pass123 (existing orders)' as result;
