// Forja: corre las migraciones y sus pruebas en un Postgres local (PGlite) con un esquema
// mínimo que imita a Supabase (auth.users, auth.uid(), storage.objects y los roles).
// No toca el proyecto real. Uso, con PGlite instalado en cualquier carpeta:
//   NODE_PATH=<carpeta>/node_modules node supabase/tests/run-local.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, 'x.js') : import.meta.url)
const { PGlite } = await import(require.resolve('@electric-sql/pglite'))

const here = dirname(fileURLToPath(import.meta.url))
const migrations = join(here, '..', 'migrations')

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;
create schema auth; create schema storage;
grant usage on schema auth, storage, public to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to authenticated;
`

const db = new PGlite()
await db.exec(SUPABASE_STUB)

// Solo migraciones de Forja que crean cosas; 0000* son de limpieza del proyecto anterior.
for (const f of readdirSync(migrations).filter(f => /^\d{4}_forja/.test(f)).sort()) {
  await db.exec(readFileSync(join(migrations, f), 'utf8'))
  console.log('migración aplicada:', f)
}

let failed = false
for (const f of readdirSync(here).filter(f => f.endsWith('.test.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(here, f), 'utf8'))
    console.log(f, '→ terminó sin el resumen esperado'); failed = true
  } catch (e) {
    const msg = String(e.message)
    const m = msg.match(/(\d+) de (\d+) pruebas OK/)
    const pass = m && m[1] === m[2] && !/FALLOS/.test(msg)
    console.log(pass ? 'OK  ' : 'FAIL', f, '→', msg)
    if (!pass) failed = true
  }
}
process.exit(failed ? 1 : 0)
