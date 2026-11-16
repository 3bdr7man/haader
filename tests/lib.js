/* بيئة اختبار مستقلة: قاعدة بيانات وهمية داخل الصفحة + رايات وهمي. لا تمس المنصة المنشورة ولا رايات الحقيقي. */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const XL = JSON.parse(fs.readFileSync(__dirname + '/fixtures/sections.json', 'utf8'));

/* ---------- بيانات تجريبية بأسماء وأرقام مصطنعة على هيكل المنصة الحقيقي ---------- */
const ACC = {
  admin: { id: 'uadmin', name: 'م. مسؤول المنصة', username: 'admin', role: 'admin', active: true, perms: {} },
  t1: { id: 'ut1', name: 'م. مدرب أول', username: 't1', role: 'trainer', active: true, perms: { sync: true, export: true } },
  t2: { id: 'ut2', name: 'م. مدرب ثانٍ', username: 't2', role: 'trainer', active: true, perms: { sync: true, export: true } },
  head: { id: 'uhead', name: 'م. رئيس القسم', username: 'head', role: 'head', active: true, perms: { export: true } },
  viewer: { id: 'uview', name: 'حساب اطلاع', username: 'viewer', role: 'viewer', active: true, perms: { export: false } },
};
const fake = (crn, i) => ({ id: String(440000000 + Number(crn) * 100 + i), name: `متدرب ${crn}-${String(i).padStart(2, '0')} تجريبي` });
function seed(opts = {}) {
  const docs = {};
  Object.values(ACC).forEach((a) => { if (opts.noHead && a.role === 'head') return; docs['accounts/' + a.id] = a; });
  const dates = ['12/03/1448', '19/03/1448', '26/03/1448'];
  const cal = dates.map((d, i) => [46300 + i * 7, d, 'الثلاثاء', i + 1, '', 'نعم']);
  docs['meta/calendar'] = { rows: cal };
  docs['meta/settings'] = { allowPast: false, beforeMin: 15, depP: 10, depT: 5, diffThreshold: 0.1, lateDefault: 10, lateLimit: 15, reasons: ['ظرف صحي'], skin: 'navy', warnP: 8, warnT: 4, codes: [] };
  const owner = { 63854: 'ut1', 63857: 'ut1', 74306: 'ut1', 63905: 'ut2', 63912: 'ut2', 63856: 'ut1', 63858: 'ut1', 74307: 'ut1' };
  const G = {};
  Object.keys(owner).forEach((crn, n) => {
    const x = XL.sections[crn], cnt = x ? x.rows.length : 6;
    const rows = Array.from({ length: cnt }, (_, i) => fake(crn, i + 1));
    docs['sections/' + crn] = { course: x ? XL.courses.find((c) => c.crn === crn).name : 'التوجيه والتحويل -1', crn, dates, dept: 'قسم الحاسب وتقنية المعلومات', kind: x ? 'نظري' : 'عملي', meets: [{ day: 'الثلاثاء', dur: 100, start: '11:00' }], order: n, pair: '', rows, sheet: 'شعبة ' + crn, spec: 'تقنية شبكات الحاسب', title: 'شعبة ' + crn, trainer: owner[crn] };
    docs['marks/' + crn] = { m: {} }; docs['notes/' + crn] = { n: {} };
    if (x && !opts.noGrades) {
      const c = XL.courses.find((k) => k.crn === crn);
      G[crn] = { crn, code: c.code, name: c.name, term: c.term, termCode: '144710', hours: c.hours,
        comps: XL.dist.filter((d) => d.crn === crn).map((d) => ({ k: d.comp, desc: d.desc, part: d.part, max: d.max, mustPass: d.mustPass, due: d.deadline, scale: String(d.scale) })),
        rows: x.rows.map((r, i) => ({ id: String(r['الرقم التدريبي']), name: r['اسم المتدرب'], st: r['حالة القيد في رايات'], el: r['قابل للرصد'] === 'نعم', hrs: r['ساعات الحضور (رايات)'], last: r['آخر حضور (رايات)'] })),
        src: { file: 'seed.xlsx', at: '2026-11-13T11:00:00.000Z', by: 'uadmin', byName: 'م. مسؤول المنصة', importId: 'I0', source: 'اختبار', extracted: '13/11/2026م', note: '' }, exam: { date: '', time: '', place: '', note: '' }, flow: {} };
      docs['gsec/' + crn] = G[crn];
    }
  });
  return docs;
}

/* ---------- قاعدة البيانات الوهمية: تحاكي واجهة db وقاعدة {self} لسجل التدقيق ---------- */
const MOCK = `(() => {
  const docs = window.__SEED, subs = [], W = window.__W = [];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const colOf = (p) => p.split('/').slice(0, -1).join('/');
  const merge = (t, p) => { for (const k in p) { if (p[k] && typeof p[k] === 'object' && !Array.isArray(p[k])) { if (!t[k] || typeof t[k] !== 'object' || Array.isArray(t[k])) t[k] = {}; merge(t[k], p[k]); } else t[k] = p[k]; } return t; };
  const snap = (col) => { const l = Object.keys(docs).filter((p) => colOf(p) === col).sort().map((p) => { const d = Object.freeze(clone(docs[p])); return { id: p.split('/').pop(), exists: true, data: () => d, metadata: { fromCache: false } }; }); return { docs: l, size: l.length, empty: !l.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }; };
  const emit = (col) => subs.filter((s) => s.col === col).forEach((s) => setTimeout(() => s.fn(snap(col)), 1));
  const deny = (p) => { const s = p.split('/'); if (s[0] === 'glog' && s[1] !== window.__UID) return true; if (window.__LEVEL !== 'admin') return true; return false; };
  const fail = () => Promise.reject({ code: 'invalid_argument', message: 'denied' });
  const doc = (path) => ({ id: path.split('/').pop(), path,
    async get() { const d = docs[path]; return { id: this.id, exists: !!d, data: () => (d ? clone(d) : undefined), metadata: { fromCache: false } }; },
    async set(d) { if (window.__OFFLINE) return Promise.reject({ code: 'unavailable' }); if (deny(path)) return fail(); if (JSON.stringify(d).length > 262144) return fail(); W.push(['set', path]); docs[path] = clone(d); emit(colOf(path)); },
    async update(d) { if (window.__OFFLINE) return Promise.reject({ code: 'unavailable' }); if (deny(path) || !docs[path]) return fail(); W.push(['update', path]); merge(docs[path], clone(d)); emit(colOf(path)); },
    async delete() { if (deny(path)) return fail(); W.push(['delete', path]); delete docs[path]; emit(colOf(path)); },
    collection(sub) { return col(path + '/' + sub); } });
  const col = (c) => ({ path: c, onSnapshot(fn) { subs.push({ col: c, fn }); setTimeout(() => fn(snap(c)), 3); return () => {}; }, async get() { return snap(c); }, doc(id) { return doc(c + '/' + (id || 'x' + Math.random().toString(36).slice(2))); }, async add(d) { const r = doc(c + '/x' + Math.random().toString(36).slice(2)); await r.set(d); return r; } });
  const db = { doc, collection: col };
  window.__DL = [];
  const cap = { db, downloads: { async save({ filename, data }) { let text = ''; try { text = typeof data === 'string' ? data : await data.text(); } catch (e) { text = '[binary]'; } window.__DL.push({ filename, size: (data && data.size) || text.length, text: text.slice(0, 200000), blob: data }); } }, user: { id: async () => window.__UID, isOwner: async () => !!window.__OWNER, can: async () => true, canEdit: async () => true }, assets: null };
  window.claude = { use: async (n) => cap[n] || null };
  window.__docs = docs; window.__emit = emit;
})();`;

async function launch() { return chromium.launch(Object.assign({ args: ['--no-sandbox'] }, process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})); }
async function open(browser, who, docs, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: opts.w || 1380, height: opts.h || 900 }, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/xlsx\.full\.min\.js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js')) }); return r.abort(); });
  const acc = ACC[who];
  await page.addInitScript(({ seedDocs, uid, sid, level }) => { window.__SEED = seedDocs; window.__UID = uid; window.__LEVEL = level; try { sessionStorage.setItem('haader.s', JSON.stringify({ id: sid, exp: Date.now() + 3600e3 })); } catch (e) { /* */ } }, { seedDocs: docs, uid: opts.uid === undefined ? 'cu_' + acc.id : opts.uid, sid: acc.id, level: opts.level || 'admin' });
  await page.addInitScript(MOCK);
  await page.goto('file://' + (opts.file || process.env.HAADER_FILE || ROOT + '/index.html'));
  await page.waitForFunction(() => typeof A !== 'undefined' && A.me && A.m && A.m.sections && A.m.sections.length && A.got.gsec && A.got.gmarks, null, { timeout: 15000 });
  page.errs = errs; page.ctx = ctx;
  return page;
}
const flush = (page) => page.waitForFunction(() => !Q.length && !qBusy, null, { timeout: 8000 }).then(() => page.waitForTimeout(60));
const view = async (page, v) => { await page.evaluate((x) => go(x), v); await page.waitForTimeout(40); };
const text = (page, sel = '#main') => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
const toast = (page) => page.evaluate(() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; });
const dbDocs = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__docs)));

/* ---------- رايات وهمي بالواجهات التي فُحصت في رايات الحقيقي ---------- */
function rayat(state) {
  /* state: { secs: {crn: {term, subject, courseNumber, title, comps:[{name, weight, id, open}], roster:[{bannerId, name, reg, gradable}], scores:{compName:{bannerId: number|null}} }}, failPost, postLog } */
  state.postLog = state.postLog || []; state.calls = state.calls || [];
  return async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace('/FacultySelfService/ssb/', ''), q = Object.fromEntries(u.searchParams), json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
    state.calls.push(req.method() + ' ' + p);
    if (state.down) return route.abort('connectionreset');
    if (!p.includes('/')) return route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="synchronizerToken" content="tok-123"></head><body dir="rtl">رايات تجريبي</body></html>' });
    const page = (rows) => { const o = +q.pageOffset || 0, m = +q.pageMaxSize || 50; return { success: true, data: rows.slice(o, o + m), totalCount: rows.length, pageOffset: o, pageMaxSize: m }; };
    if (p === 'gradebook/sections') return json(page(Object.entries(state.secs).filter(([, s]) => !s.hidden).map(([crn, s]) => ({ courseReferenceNumber: crn, term: s.term, subject: s.subject, courseNumber: s.courseNumber, courseTitle: s.title, eligible: s.roster.filter((r) => r.gradable).length, enrolled: s.roster.length, graded: 0, enterAccess: s.enter !== false, rolledStatus: 'N' }))));
    if (p === 'componentGradeRoster/batch' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}'), rows = body.update || [];
      state.postLog.push({ at: Date.now(), n: rows.length, comp: rows[0] && rows[0].componentId, token: req.headers()['x-synchronizer-token'], rows: rows.map((r) => [r.bannerId, r.score, r.currentReason]) });
      if (state.failPost && state.failPost(state.postLog.length, rows)) { state.postLog[state.postLog.length - 1].aborted = true; return route.abort('connectionreset'); }
      const out = [];
      for (const [, sec] of Object.entries(state.secs)) for (const c of sec.comps) rows.filter((r) => r.componentId === c.id).forEach((r) => {
        const v = Number(r.score), max = c.total === undefined ? c.weight : c.total;
        if (!(v >= 0) || v > max || (state.reject && state.reject(r))) out.push({ id: r.id, score: null, messages: [{ type: 'error', field: 'score', message: 'الدرجة خارج النطاق المسموح' }] });
        else { if (!state.dropWrites) sec.scores[c.name][r.bannerId] = v; out.push({ id: r.id, score: String(v), messages: [] }); }
      });
      return json({ success: true, data: { update: out } });
    }
    const s = state.secs[q.selectedCrn || q.courseReferenceNumber];
    if (!s) return json({ success: false, data: [], totalCount: 0 });
    if (p === 'component/fetchComponents') return json(page(s.comps.map((c) => ({ name: c.name, weight: String(c.weight), gradeScale: '100', id: c.id, gradeComponentId: c.id, isAssessmentOpen: c.open !== false, subcomponents: false, dueDate: '01/جمادى الآخرة/1448', mustPass: 'لا', description: c.name }))));
    if (p === 'componentGradeRoster/fetchComponentGradeRoster') {
      const c = s.comps.find((x) => String(x.id) === String(q.selectedComponentId));
      if (!c) return json({ success: false, data: [], totalCount: 0 });
      if (state.failRead === c.name) return json({ error: 'x' }, 500);
      const rows = s.roster.filter((r) => r.gradable).map((r) => ({ id: c.id * 1000 + s.roster.indexOf(r), componentId: c.id, bannerId: r.bannerId, studentPidm: 9000 + s.roster.indexOf(r), studentFullName: r.name, score: s.scores[c.name][r.bannerId] === undefined ? null : s.scores[c.name][r.bannerId], totalScore: String(c.total === undefined ? c.weight : c.total), gradeScale: '100', readOnly: !!r.readOnly, rolled: false, currentReason: 'OE', completedDate: '02/جمادى الآخرة/1448', updateComposite: true, isComponent: true, termCode: s.term, courseReferenceNumber: q.selectedCrn }));
      return json(Object.assign(page(rows), { readOnlyRoster: false, validationMap: { validGradeChangeReasons: [{ code: 'EE', description: 'خطأ إدخال' }, { code: 'OE', description: 'ادخال اساسي' }] } }));
    }
    if (p === 'courseGradeRoster/fetchCourseRoster') return json(page(s.roster.map((r) => ({ bannerId: r.bannerId, personFullName: r.name, courseRegistrationStatusDescription: r.reg || 'مسجل', gradableIndicator: r.gradable ? 'Y' : 'N' }))));
    return json({ success: false }, 404);
  };
}
function rayatFrom(docs, crns) {
  const secs = {};
  crns.forEach((crn, n) => { const g = docs['gsec/' + crn]; secs[crn] = { term: '144710', subject: g.code.split(' ')[0], courseNumber: g.code.split(' ')[1], title: g.name, comps: g.comps.map((c, i) => ({ name: c.k, weight: c.max, id: 1000 * (n + 1) + i })), roster: g.rows.map((r) => ({ bannerId: r.id, name: r.name, reg: r.st, gradable: r.el })), scores: Object.fromEntries(g.comps.map((c) => [c.k, {}])) }; });
  return { secs };
}
async function openRayat(ctx, state) {
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('https://rayat.test/**', rayat(state));
  await page.goto('https://rayat.test/FacultySelfService/ssb/gradeEntry');
  page.errs = errs;
  return page;
}
const BRIDGE = () => fs.readFileSync(ROOT + '/build/bridge.full.js', 'utf8');
/* يشغّل الجسر في رايات الوهمي كما يفعل المدرب: لصق الحزمة ثم متابعة */
async function bridgePaste(rp, pkg) {
  await rp.evaluate(BRIDGE());
  if (!(await rp.$('#hb main textarea[placeholder]'))) { const o = await rp.$('#hb button:has-text("حزمة أخرى")'); if (o) await o.click(); }
  await rp.waitForSelector('#hb textarea[placeholder]');
  await rp.fill('#hb textarea[placeholder]', pkg);
  await rp.click('#hb button:has-text("متابعة")');
  await rp.waitForFunction(() => { const t = document.querySelector('#hb main').innerText; return /لم يُكتب أي شيء|تعذرت القراءة|ليس حزمة/.test(t); }, null, { timeout: 15000 });
  return rp.evaluate(() => document.querySelector('#hb main').innerText);
}
module.exports = { fs, ROOT, XL, ACC, fake, seed, launch, open, flush, view, text, toast, dbDocs, rayat, rayatFrom, openRayat, BRIDGE, bridgePaste };
