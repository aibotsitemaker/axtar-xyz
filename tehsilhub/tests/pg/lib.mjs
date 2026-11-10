// Real PostgreSQL 16 üzərində SQL testləri üçün kiçik köməkçi (psql ilə). Əlavə npm paketi lazım deyil.
// Hər çağırış ayrı sessiyadır: rol və JWT "sub" hər dəfə əvvəlcədən təyin edilir (PostgREST davranışı kimi).
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DB = process.env.TEST_DB || 'tehsilhub_test';
const ENV = { ...process.env, PGOPTIONS: '-c client_min_messages=warning' };

function pre({ as, uid }) {
  // as: 'anon' | 'authenticated' | undefined (= SQL Editor / postgres, auth.uid() boş)
  let s = '';
  if (as) s += `set role ${as};\n`;
  if (uid) s += `set request.jwt.claim.sub = '${uid}';\n`;
  return s;
}

export function run(sql, opts = {}) {
  const db = opts.db || DB;
  const r = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', db],
    { input: pre(opts) + sql, encoding: 'utf8', env: ENV, maxBuffer: 64 * 1024 * 1024 });
  const err = (r.stderr || '').split('\n').map((l) => l.replace(/^psql:.*?:\d+: /, '')).join('\n').trim();
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err };
}

export function runAsync(sql, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', opts.db || DB], { env: ENV });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ ok: code === 0, out: out.trim(), err: err.trim() }));
    p.stdin.end(pre(opts) + sql);
  });
}

// Nəticəni JSON massivi kimi qaytarır
export function rows(sql, opts = {}) {
  const r = run(`select coalesce(json_agg(q), '[]'::json)::text from (${sql.replace(/;\s*$/, '')}) q;`, opts);
  if (!r.ok) throw new Error(`SQL xətası: ${r.err}\n${sql}`);
  return JSON.parse(r.out || '[]');
}
export const scalar = (sql, opts = {}) => {
  const r = run(sql.replace(/;\s*$/, '') + ';', opts);
  if (!r.ok) throw new Error(`SQL xətası: ${r.err}\n${sql}`);
  return r.out.split('\n')[0];
};

const results = [];
let section = '';
export const group = (name) => { section = name; console.log(`\n## ${name}`); };
function rec(ok, name, extra) {
  results.push({ ok, name: `${section} › ${name}`, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      -> ${extra}`}`);
}
export const check = (name, cond, extra = '') => rec(!!cond, name, extra);
export function expectOk(name, sql, opts) {
  const r = run(sql, opts); rec(r.ok, name, r.err.slice(0, 300)); return r;
}
export function expectFail(name, sql, pattern, opts) {
  const r = run(sql, opts);
  const good = !r.ok && (!pattern || new RegExp(pattern, 'i').test(r.err));
  rec(good, name, r.ok ? 'əmr uğurla icra olundu (bloklanmalı idi)' : `gözlənilməyən xəta: ${r.err.slice(0, 250)}`);
  return r;
}
export function finish() {
  const bad = results.filter((r) => !r.ok);
  console.log(`\nCƏMİ: ${results.length - bad.length} keçdi, ${bad.length} uğursuz`);
  if (bad.length) { bad.forEach((b) => console.log(` ✗ ${b.name}: ${b.extra}`)); process.exit(1); }
}
export const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Test istifadəçisi yaradır (auth.users insert → handle_new_user trigger profil yaradır)
export function signup(id, email, accountType, { confirmed = true, name, extraMeta = {} } = {}) {
  const meta = { full_name: name || email.split('@')[0], ...(accountType === undefined ? {} : { account_type: accountType }), ...extraMeta };
  return run(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('${id}','${email}',${confirmed ? 'now()' : 'null'},${sqlStr(JSON.stringify(meta))}::jsonb);`);
}
export const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
