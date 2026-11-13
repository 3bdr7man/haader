const L = require('./lib');
(async () => {
  const b = await L.launch();
  for (const who of ['t1', 'admin', 'head', 'viewer']) {
    const p = await L.open(b, who, L.seed());
    const nav = await p.evaluate(() => [...document.querySelectorAll('#nav .grp')].map((x) => x.textContent));
    const out = [];
    for (const v of ['gdash', 'gsecs', 'gexams', 'gentry', 'greview', 'gsched', 'gsync', 'glog', 'greports', 'gcfg', 'home', 'dash', 'roll', 'sync', 'alerts', 'insights', 'bdash', 'reports', 'calendar', 'guide', 'log']) {
      await L.view(p, v);
      const t = await L.text(p);
      out.push(v + ':' + t.length + (/undefined|NaN|\[object/.test(t) ? ' !BAD(' + (t.match(/.{0,40}(undefined|NaN|\[object).{0,30}/) || [''])[0].replace(/\n/g, ' ') + ')' : ''));
    }
    await p.evaluate(() => { A.gCrn = '63854'; go('gsec'); }); await p.waitForTimeout(50);
    const t = await L.text(p); out.push('gsec:' + t.length + (/undefined|NaN|\[object/.test(t) ? ' !BAD' : ''));
    console.log(who, '| nav:', nav.join(' / '), '\n ', out.join(' '), '\n  errs:', p.errs.slice(0, 5));
    if (who === 't1') { await L.view(p, 'gsecs'); await p.screenshot({ path: __dirname + '/out/s-gsecs.png', fullPage: true }); await p.evaluate(() => { A.gCrn = '63854'; go('gsec'); }); await p.waitForTimeout(80); await p.screenshot({ path: __dirname + '/out/s-gsec.png', fullPage: true }); }
    await p.ctx.close();
  }
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
