const L = require('./lib.js');
(async () => {
  const b = await L.launch(), docs = L.seed();
  for (const [lbl, w, h] of [['حاسب', 1380, 900], ['جوال', 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'ar-SA' });
    const t0 = Date.now();
    const p = await L.open(b, 'admin', docs, { ctx, uid: 'cu_uadmin' });
    const boot = Date.now() - t0;
    const nodes = await p.evaluate(() => document.querySelectorAll('*').length);
    const nav = await p.evaluate(() => [...document.querySelectorAll('#nav .grp, #nav a')].map((e) => (e.classList.contains('grp') ? '## ' + e.textContent : e.textContent)));
    const views = ['home', 'dash', 'insights', 'bdash', 'gdash', 'roll', 'greports', 'guide', 'qr', 'taccs', 'gsecs', 'alerts'];
    const out = {};
    for (const v of views) { const ms = await p.evaluate(async (x) => { const t = performance.now(); go(x); await new Promise((r) => requestAnimationFrame(r)); return Math.round(performance.now() - t); }, v); out[v] = ms; }
    const dom = await p.evaluate(() => document.querySelectorAll('#main *').length);
    console.log(`\n== ${lbl} ${w}×${h} ==`);
    console.log('  إقلاع حتى أول عرض:', boot, 'ms | عناصر الصفحة:', nodes, '| عناصر #main بعد التنقل:', dom);
    console.log('  زمن عرض كل واجهة (ms):', Object.entries(out).map(([k, v]) => `${k}:${v}`).join(' '));
    if (lbl === 'حاسب') console.log('  القائمة كما يراها المسؤول:\n   ', nav.join(' | '));
    await ctx.close();
  }
  await b.close();
})();
