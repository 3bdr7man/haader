/* جسر الدرجات: يعمل داخل تبويب رايات بجلسة المدرب. يقرأ سجل الدرجات، يقارن، ولا يكتب إلا بضغطة صريحة،
   ثم يعيد القراءة. لا يقرأ كلمة المرور ولا يتجاوز الدخول. الطلبات هي طلبات صفحة «سجل الدرجات» نفسها. */
!(function () {
  var B = '/FacultySelfService/ssb/';
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var num = function (v) { if (v === null || v === undefined || v === '') return null; var n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var f = function (v) { return v === null || v === undefined ? 'فارغ' : String(r2(v)); };
  var ui = function () { return window.__HB && window.__HB.ui; };
  async function get(path, params) {
    var url = B + path + '?' + new URLSearchParams(params).toString(), err;
    for (var i = 0; i < 3; i++) {
      try {
        var r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
        if (r.headers.get('X-Login-Page') === 'true' || (r.redirected && /login|cas|sso/i.test(r.url))) throw new Error('انتهت جلسة رايات. سجّل الدخول ثم أعد المحاولة');
        if (r.ok) return await r.json();
        err = new Error('HTTP ' + r.status);
      } catch (e) { err = e; if (/جلسة/.test(String(e.message))) throw e; }
      await wait(900 * (i + 1));
    }
    throw err;
  }
  async function pages(path, params, size) {
    var out = [], off = 0, top = null;
    for (var i = 0; i < 20; i++) {
      var p = Object.assign({}, params, { pageMaxSize: size, pageOffset: off });
      var j = await get(path, p), d = Array.isArray(j) ? j : j.data || [];
      if (i === 0) top = j;
      out = out.concat(d);
      var tot = Number(j.totalCount || d.length);
      off += size;
      if (!d.length || out.length >= tot) break;
    }
    return { rows: out, top: top || {} };
  }
  /* قراءة الشعبة كاملة: وجودها في مقررات المدرب، مكوّناتها وحدودها، ودرجات كل متدرب قابل للرصد */
  async function read(pkg, onStep) {
    var res = { app: 'haader-grades-result', v: 1, op: pkg.op, crn: String(pkg.crn), term: pkg.term || '', mode: pkg.mode, at: new Date().toISOString(), status: 'ok', sec: null, comps: [], roster: {}, all: [], applied: null };
    var raw = { comps: {}, rows: {} };
    try {
      onStep && onStep('قراءة مقررات المدرب…');
      var secs = (await pages('gradebook/sections', { searchString: '', sortColumn: 'courseReferenceNumber', sortDirection: 'asc' }, 50)).rows;
      var mine = secs.filter(function (s) { return String(s.courseReferenceNumber) === String(pkg.crn); });
      if (pkg.term) mine = mine.filter(function (s) { return String(s.term) === String(pkg.term); }).concat(mine.filter(function (s) { return String(s.term) !== String(pkg.term); }));
      var s = mine[0];
      if (!s) { res.status = 'nosection'; return { res: res, raw: raw }; }
      res.term = String(s.term);
      res.sec = { subject: s.subject, courseNumber: s.courseNumber, title: s.courseTitle, eligible: s.eligible, enrolled: s.enrolled, graded: s.graded, enter: s.enterAccess, rolled: s.rolledStatus };
      onStep && onStep('قراءة المكوّنات…');
      var comps = (await pages('component/fetchComponents', { filterText: '', selectedAssessmentType: 'assessment', selectedCrn: res.crn, selectedTerm: res.term, sortColumn: 'name', sortDirection: 'asc' }, 50)).rows;
      for (var i = 0; i < comps.length; i++) {
        var c = comps[i], k = String(c.name);
        onStep && onStep('قراءة درجات ' + k + ' (' + (i + 1) + ' من ' + comps.length + ')…');
        var cc = { k: k, id: c.id, max: num(c.weight), open: !!c.isAssessmentOpen, due: c.dueDate || '', sub: !!c.subcomponents, ro: false, err: '' };
        try {
          var pr = await pages('componentGradeRoster/fetchComponentGradeRoster', { filterText: '', selectedAssessmentType: 'assessment', selectedComponentId: c.id, selectedCrn: res.crn, selectedTerm: res.term, sortColumn: 'studentFullName', sortDirection: 'asc' }, 50);
          cc.ro = !!pr.top.readOnlyRoster;
          raw.rows[k] = {}; raw.comps[k] = { reasons: ((pr.top.validationMap || {}).validGradeChangeReasons) || [] };
          pr.rows.forEach(function (x) {
            var id = String(x.bannerId), t = num(x.totalScore);
            if (t !== null) cc.max = t;
            var e = res.roster[id] || (res.roster[id] = { n: x.studentFullName || '', g: {}, ro: {} });
            e.g[k] = num(x.score); if (x.readOnly || x.rolled) e.ro[k] = 1;
            raw.rows[k][id] = x;
          });
        } catch (e) { cc.err = String(e.message || e); Object.keys(res.roster).forEach(function (id) { (res.roster[id].e = res.roster[id].e || {})[k] = 1; }); res.partial = true; }
        res.comps.push(cc);
        await wait(120);
      }
      /* من تعذرت قراءة مكوّن له يُعلَّم «تعذر التحقق» */
      res.comps.filter(function (c) { return c.err; }).forEach(function (c) { Object.keys(res.roster).forEach(function (id) { (res.roster[id].e = res.roster[id].e || {})[c.k] = 1; delete res.roster[id].g[c.k]; }); });
      try {
        onStep && onStep('قراءة قائمة المسجلين…');
        var all = (await pages('courseGradeRoster/fetchCourseRoster', { term: res.term, courseReferenceNumber: res.crn, type: 'final', sortColumn: 'personFullName', sortDirection: 'asc', filterText: '' }, 50)).rows;
        res.all = all.map(function (x) { return { id: String(x.bannerId), n: x.personFullName || '', st: x.courseRegistrationStatusDescription || '', gr: x.gradableIndicator || '' }; });
      } catch (e) { res.all = []; }
    } catch (e) { res.status = 'error'; res.error = String(e.message || e); }
    return { res: res, raw: raw };
  }
  /* مقارنة الحزمة بما في رايات: ما يُكتب، وما هو مطابق، وما يمنع التطبيق */
  function plan(pkg, got) {
    var res = got.res, P = { writes: [], same: 0, over: 0, stop: [], warn: [] };
    if (res.status === 'nosection') { P.stop.push('الشعبة ' + pkg.crn + ' غير موجودة في مقرراتك في رايات.'); return P; }
    if (res.status !== 'ok') { P.stop.push('تعذرت قراءة رايات: ' + (res.error || '')); return P; }
    if (res.sec && res.sec.enter === false) P.stop.push('حسابك لا يملك صلاحية إدخال درجات هذه الشعبة في رايات.');
    var rc = {}; res.comps.forEach(function (c) { rc[c.k] = c; });
    pkg.comps.forEach(function (c) {
      var x = rc[c.k];
      if (!x) P.stop.push('المكوّن ' + c.k + ' غير موجود في رايات.');
      else if (x.err) P.stop.push('تعذرت قراءة المكوّن ' + c.k + ': ' + x.err);
      else if (x.max !== Number(c.max)) P.stop.push('الحد الأعلى للمكوّن ' + c.k + ' في رايات ' + x.max + ' وفي حاضر ' + c.max + '.');
      else if (x.sub) P.stop.push('المكوّن ' + c.k + ' له مكوّنات فرعية في رايات، ولا يُرصد مباشرة.');
    });
    res.comps.forEach(function (c) { if (!pkg.comps.some(function (x) { return x.k === c.k; })) P.stop.push('المكوّن ' + c.k + ' موجود في رايات وغير موجود في توزيع حاضر.'); });
    var ids = {}; pkg.rows.forEach(function (r) {
      if (ids[r.id]) P.stop.push('الرقم التدريبي ' + r.id + ' مكرر في الحزمة.'); ids[r.id] = 1;
      var x = res.roster[r.id];
      if (!x) { P.stop.push((r.n || r.id) + ' (' + r.id + '): غير موجود في كشف المكوّنات في رايات أو غير قابل للرصد.'); return; }
      pkg.comps.forEach(function (c) {
        var want = r.g[c.k], have = x.g[c.k];
        if (want === null || want === undefined) { P.stop.push((r.n || r.id) + ': درجة ' + c.k + ' ناقصة في الحزمة.'); return; }
        if (typeof want !== 'number' || !isFinite(want) || want < 0 || want > Number(c.max) || r2(want) !== want) { P.stop.push((r.n || r.id) + ': الدرجة ' + want + ' في ' + c.k + ' تخالف الحد المعتمد ' + c.max + '.'); return; }
        if (have !== null && have !== undefined && r2(have) === r2(want)) { P.same++; return; }
        if (x.ro[c.k]) { P.stop.push((r.n || r.id) + ': خانة ' + c.k + ' مقفلة في رايات (للقراءة فقط أو مرحّلة).'); return; }
        if (rc[c.k] && !rc[c.k].open) { P.stop.push('إدخال المكوّن ' + c.k + ' مغلق في رايات.'); return; }
        if (have !== null && have !== undefined) P.over++;
        P.writes.push({ id: r.id, n: r.n || x.n, k: c.k, from: have === undefined ? null : have, to: want });
      });
    });
    Object.keys(res.roster).forEach(function (id) { if (!ids[id]) P.stop.push(res.roster[id].n + ' (' + id + '): قابل للرصد في رايات وغير موجود في حزمة حاضر. حدّث قائمة المتدربين في حاضر أولاً.'); });
    /* لا تكرار للسبب نفسه */
    P.stop = P.stop.filter(function (x, i, a) { return a.indexOf(x) === i; });
    return P;
  }
  /* الكتابة: طلب واحد لكل مكوّن كما تفعل الصفحة، بالصفوف المختلفة فقط */
  async function apply(pkg, got, P, reason, onStep, stopped) {
    var done = 0, failed = [], byK = {};
    P.writes.forEach(function (w) { (byK[w.k] = byK[w.k] || []).push(w); });
    var ks = Object.keys(byK);
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], list = byK[k];
      if (stopped && stopped()) { list.forEach(function (w) { failed.push({ id: w.id, n: w.n, k: k, why: 'أُوقف قبل الإرسال' }); }); continue; }
      onStep && onStep('إرسال ' + k + ': ' + list.length + ' درجة (' + (i + 1) + ' من ' + ks.length + ')…');
      var body = { update: list.map(function (w) { var row = JSON.parse(JSON.stringify(got.raw.rows[k][w.id])); row.score = String(w.to); if (w.from !== null && reason) row.currentReason = reason; return row; }) };
      try {
        var tok = document.querySelector('meta[name="synchronizerToken"]'), h = { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json;charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' };
        if (tok && tok.content) h['X-Synchronizer-Token'] = tok.content;
        var r = await fetch(B + 'componentGradeRoster/batch', { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify(body) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var j = await r.json(), up = (j && (j.update || (j.data && j.data.update))) || [], msgs = {};
        up.forEach(function (u) { var e = (u.messages || []).filter(function (m) { return m.type === 'error'; }).map(function (m) { return m.message; }).join('؛ '); if (e) msgs[String(u.id)] = e; });
        list.forEach(function (w) { var rid = String(got.raw.rows[k][w.id].id), e = msgs[rid]; if (e) failed.push({ id: w.id, n: w.n, k: k, why: e }); else done++; });
        if (j && j.success === false && !Object.keys(msgs).length) { done -= list.length; list.forEach(function (w) { failed.push({ id: w.id, n: w.n, k: k, why: 'رفض رايات الطلب' }); }); }
      } catch (e) { list.forEach(function (w) { failed.push({ id: w.id, n: w.n, k: k, why: 'لم يُعرف هل وصل الطلب: ' + String(e.message || e) }); }); }
      await wait(250);
    }
    return { done: Math.max(0, done), failed: failed, sent: P.writes.length };
  }
  function show(pkg) {
    var U = ui(); if (!U) { window.alert('حدّث إشارة «جسر حاضر» من منصة حاضر ثم أعد المحاولة.'); return; }
    var el = U.el, btn = U.btn, main = U.d.main, stop = false, got = null, P = null, text = '';
    var say = function (t) { U.clear(); main.appendChild(el('div', 'b', 'درجات الشعبة ' + pkg.crn + ' — ' + (pkg.name || '') + ' — العملية ' + pkg.op)); var d = el('div', '', t); main.appendChild(d); return d; };
    var out = function (res) { return JSON.stringify(res); };
    async function finish(res, head, cls) {
      text = out(res); U.clear();
      main.appendChild(el('div', (cls || '') + ' b', head));
      var ok = await U.copy(text);
      main.appendChild(el('div', 'm', ok ? 'نُسخت النتيجة. الصقها في «المزامنة مع منصة رايات» بمنصة حاضر.' : 'انسخ النتيجة التالية والصقها في المنصة:'));
      if (!ok) U.dump(text);
      var row = el('div', 'row');
      row.appendChild(btn('نسخ النتيجة', 'p', async function (e) { var t = await U.copy(text); e.target.textContent = t ? 'نُسخت ✓' : 'تعذر النسخ'; if (!t) U.dump(text); }));
      row.appendChild(btn('حزمة أخرى', '', function () { U.back(); }));
      main.appendChild(row);
    }
    async function review() {
      var line = say('جارٍ قراءة رايات…');
      got = await read(pkg, function (t) { line.textContent = t; });
      P = plan(pkg, got);
      U.clear();
      var res = got.res;
      main.appendChild(el('div', 'b', 'درجات الشعبة ' + pkg.crn + ' — ' + (pkg.name || '') + (res.sec ? ' (' + res.sec.subject + ' ' + res.sec.courseNumber + ')' : '')));
      main.appendChild(el('div', 'm', 'العملية ' + pkg.op + ' • ' + pkg.rows.length + ' متدرباً • ' + pkg.comps.map(function (c) { return c.k + ' ' + c.max; }).join('، ')));
      main.appendChild(el('div', 'm', 'لم يُكتب أي شيء في رايات حتى الآن.'));
      if (P.stop.length) {
        var box = el('div', 'r'); box.appendChild(el('div', 'e b', 'لا يمكن التطبيق (' + P.stop.length + '):'));
        var ul = el('ul'); P.stop.slice(0, 25).forEach(function (s) { ul.appendChild(el('li', '', s)); }); box.appendChild(ul); main.appendChild(box);
      }
      main.appendChild(el('div', P.writes.length ? 'b' : 'ok b', 'مطابق: ' + P.same + ' • سيُكتب: ' + P.writes.length + (P.over ? ' • منها استبدال درجة موجودة: ' + P.over : '')));
      if (P.writes.length) {
        var det = el('details', 'r'); det.appendChild(el('summary', '', 'عرض الدرجات التي ستُكتب'));
        var l = el('ul'); P.writes.slice(0, 400).forEach(function (w) { l.appendChild(el('li', '', w.n + ' — ' + w.k + ': ' + f(w.from) + ' ← ' + f(w.to))); }); det.appendChild(l); main.appendChild(det);
      }
      var sel = null;
      if (pkg.mode === 'push' && P.over && !P.stop.length) {
        var rs = []; Object.keys(got.raw.comps).forEach(function (k) { (got.raw.comps[k].reasons || []).forEach(function (r) { if (!rs.some(function (x) { return x.code === r.code; })) rs.push(r); }); });
        main.appendChild(el('div', 'w', 'توجد ' + P.over + ' درجة مسجلة في رايات ستُستبدل. اختر سبب تغيير الدرجة كما يطلبه رايات:'));
        sel = document.createElement('select'); sel.setAttribute('aria-label', 'سبب تغيير الدرجة');
        var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'اختر السبب'; sel.appendChild(o0);
        rs.forEach(function (r) { var o = document.createElement('option'); o.value = r.code; o.textContent = r.description + ' — ' + r.code; sel.appendChild(o); });
        main.appendChild(sel);
      }
      var row = el('div', 'row');
      if (pkg.mode === 'push' && P.writes.length && !P.stop.length) {
        row.appendChild(btn('تطبيق ' + P.writes.length + ' درجة على رايات', 'd', async function () {
          if (sel && !sel.value) { sel.focus(); return; }
          var line2 = say('جارٍ الإرسال…'); stop = false;
          var sb = btn('إيقاف', '', function () { stop = true; sb.disabled = true; }); main.appendChild(sb);
          var ap = await apply(pkg, got, P, sel ? sel.value : '', function (t) { line2.textContent = t; }, function () { return stop; });
          line2.textContent = 'جارٍ التحقق بإعادة القراءة…';
          var again = await read(pkg, function (t) { line2.textContent = 'التحقق: ' + t; });
          again.res.applied = ap; again.res.mode = 'push';
          var P2 = plan(pkg, again), left = P2.writes.length + P2.stop.length;
          await finish(again.res, 'أُرسلت ' + ap.sent + ' درجة: نجح ' + ap.done + (ap.failed.length ? '، وفشل ' + ap.failed.length : '') + (left ? '، وبقي ' + P2.writes.length + ' مختلفاً بعد التحقق' : '، والتحقق مطابق تماماً ✓'), left || ap.failed.length ? 'e' : 'ok');
        }));
      }
      row.appendChild(btn(pkg.mode === 'push' && P.writes.length && !P.stop.length ? 'نسخ نتيجة القراءة فقط' : 'نسخ النتيجة للمنصة', pkg.mode === 'push' && P.writes.length && !P.stop.length ? '' : 'p', async function () { res.mode = 'read'; await finish(res, P.writes.length || P.stop.length ? 'قراءة فقط: ' + P.same + ' مطابق، ' + P.writes.length + ' مختلف' : 'رايات مطابق لحاضر تماماً ✓', P.writes.length || P.stop.length ? 'w' : 'ok'); }));
      row.appendChild(btn('إعادة القراءة', '', function () { review(); }));
      row.appendChild(btn('حزمة أخرى', '', function () { U.back(); }));
      main.appendChild(row);
    }
    review().catch(function (e) { U.clear(); main.appendChild(el('div', 'e', 'تعذرت القراءة: ' + (e.message || e))); main.appendChild(btn('رجوع', '', function () { U.back(); })); });
  }
  window.__HBG = { run: function (pkg) { if (!pkg || pkg.app !== 'haader-grades' || !pkg.crn || !Array.isArray(pkg.rows) || !Array.isArray(pkg.comps)) throw new Error('حزمة الدرجات غير صالحة'); show(pkg); }, read: read, plan: plan, apply: apply };
})();
