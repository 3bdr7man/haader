// أدوات اختبار الخادم المحلي (Postgres + GoTrue + PostgREST الحقيقيان عبر بوابة 54321)
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const BASE = process.env.HB || 'http://127.0.0.1:54321';
const PG = ['-h', '/var/tmp/hpg', '-p', '55432', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'];

const sql = (q) => execFileSync('psql', PG.concat(['-c', q]), { encoding: 'utf8' }).trim();
const hex = (b) => Buffer.from(b).toString('hex');
const pbkdf2 = (pw, saltHex, iter) => crypto.pbkdf2Sync(pw, Buffer.from(saltHex, 'hex'), iter, 32, 'sha256').toString('hex');
function pwFields(pw) { const salt = hex(crypto.randomBytes(16)), iter = 150000; return { salt, iter, hash: pbkdf2(pw, salt, iter) }; }

async function req(path, { method = 'GET', body, token, headers } = {}) {
  const h = Object.assign({ 'Content-Type': 'application/json', apikey: 'local' }, token ? { Authorization: 'Bearer ' + token } : {}, headers || {});
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
  return { status: r.status, ok: r.ok, body: j };
}
const rpc = (fn, args, token) => req('/rest/v1/rpc/' + fn, { method: 'POST', body: args || {}, token });

// الدخول كما تفعله الواجهة: الملح ← البصمة ← رمز الدخول
async function login(user, pw) {
  const s = await rpc('login_salt', { p_user: user });
  if (!s.ok) return { ok: false, step: 'salt', res: s };
  const H = pbkdf2(pw, s.body.salt, s.body.iter);
  const t = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: s.body.email, password: H } });
  return { ok: t.ok, status: t.status, token: t.body && t.body.access_token, refresh: t.body && t.body.refresh_token, err: t.ok ? '' : (t.body && (t.body.error_description || t.body.msg || t.body.error_code)), body: t.body };
}

const docGet = (col, id, token) => req(`/rest/v1/doc?col=eq.${encodeURIComponent(col)}&id=eq.${encodeURIComponent(id)}&select=id,data,crn`, { token });
const docList = (col, token) => req(`/rest/v1/doc?col=eq.${encodeURIComponent(col)}&select=id,data,crn`, { token });
const docSet = (col, id, data, token) => req('/rest/v1/doc?on_conflict=col,id', { method: 'POST', token, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { col, id, data } });
const docAdd = (col, id, data, token) => req('/rest/v1/doc', { method: 'POST', token, headers: { Prefer: 'return=minimal' }, body: { col, id, data } });
const docMerge = (col, id, patch, token) => rpc('doc_merge', { p_col: col, p_id: id, p_patch: patch, p_crn: null }, token);
const docDel = (col, id, token) => req(`/rest/v1/doc?col=eq.${encodeURIComponent(col)}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', token, headers: { Prefer: 'return=representation' } });

let pass = 0, fail = 0; const fails = [];
function check(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; fails.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); } }
function done(title) { console.log(`\n${title}: ${pass} نجح، ${fail} فشل`); if (fail) { console.log('الفاشلة: ' + fails.join(' | ')); process.exitCode = 1; } }

module.exports = { sql, pbkdf2, pwFields, req, rpc, login, docGet, docList, docSet, docAdd, docMerge, docDel, check, done, BASE };
