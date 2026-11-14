const L = require('./lib.js');
(async () => {
  const b = await L.launch(), docs = L.seed();
  const p = await L.open(b, 'admin', docs, { uid: 'cu_uadmin' });
  const nav = await p.evaluate(() => NAV.map(([g, i]) => (g || 'الرئيسية') + ': ' + i.map((x) => x[1]).join(' | ')));
  console.log(nav.join('\n'));
  await b.close();
})();
