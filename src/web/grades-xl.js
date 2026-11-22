/* ====================================================================
   نموذج إدخال الدرجات Excel (منصة حاضر)
   - ينشئ مصنفاً من بيانات المنصة نفسها: ورقة لكل شعبة باسم رقمها، وصفحة رئيسية
     بالمؤشرات ورسمين بيانيين، وتعليمات، وتوزيع الدرجات، وسلم التقديرات.
   - خلايا الدرجات وحدها قابلة للتعديل، وعليها تحقق (رقم، 0 إلى الحد، خانتان)،
     وتنسيق شرطي للناقص والخاطئ، والمجاميع والتقدير والحالة تُحسب آلياً.
   - في المصنف معرّف خفي (الفصل والمدرب والشعب وبصمة كل شعبة) يتحقق منه الاستيراد.
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const GREEN = 'FF006C35', BLUE = 'FF1F5AA6', LGREEN = 'FFE8F3EC', LBLUE = 'FFE7EEF8', INPUT = 'FFFFF8D6', GREY = 'FFF0F0F0', LINE = 'FFBFC8C2';
  const FONT = 'Arial', FOOT = 'الكلية التقنية ببيشة – منصة حاضر Haader';
  const ORGL = 'المؤسسة العامة للتدريب التقني والمهني — الكلية التقنية ببيشة';
  /* سلم التقديرات الافتراضي (قابل للتعديل من ورقة الإعدادات) */
  const SCALE = [[0, 'هـ', 'راسب'], [60, 'د', 'مقبول'], [65, 'د+', 'مقبول مرتفع'], [70, 'ج', 'جيد'], [75, 'ج+', 'جيد مرتفع'], [80, 'ب', 'جيد جداً'], [85, 'ب+', 'جيد جداً مرتفع'], [90, 'أ', 'ممتاز'], [95, 'أ+', 'ممتاز مرتفع']];
  const colL = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const q = (name) => `'${String(name).replace(/'/g, "''")}'`;
  const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hash = (s) => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  /* بصمة الشعبة: القائمة وقابلية الرصد والتوزيع والبنود. تغيّرها بعد التنزيل يعني أن المصنف قديم */
  const secSig = (sec) => hash(JSON.stringify([(sec.rows || []).map((r) => [r.id, !!r.el]), G.comps(sec).map((c) => [c.k, c.max]), sec.items || {}, sec.term || '']));
  const termYear = (t) => ((String(t || '').match(/(1[34]\d{2})\s*هـ?/) || [])[1] || '') + (/(1[34]\d{2})/.test(t || '') ? 'هـ' : '');
  const compLabel = (c) => { const d = c.desc || ''; return /نهائي/.test(d) ? 'الاختبار النهائي' : /فصلي|أعمال/.test(d) ? 'أعمال الفصل' : d || c.k; };
  function loadScript(src, test) { return new Promise((res, rej) => { if (test()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => (test() ? res() : rej(new Error('load'))); s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
  const loadLibs = () => Promise.all([loadScript('vendor/exceljs-4.4.0.min.js', () => !!window.ExcelJS), loadScript('vendor/jszip-3.10.1.min.js', () => !!window.JSZip)]);

  const border = { top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const style = (cell, o) => { cell.font = Object.assign({ name: FONT, size: 11 }, o.font || {}); if (o.fill) cell.fill = fill(o.fill); cell.alignment = Object.assign({ horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' }, o.al || {}); if (o.border !== false) cell.border = border; if (o.fmt) cell.numFmt = o.fmt; };
  const sheetBase = (ws, land) => {
    ws.headerFooter = { oddFooter: `&C&"${FONT}"&10${FOOT}&R&"${FONT}"&9&P / &N`, evenFooter: `&C&"${FONT}"&10${FOOT}` };
    ws.pageSetup = { orientation: land ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
  };
  const title = (ws, r, c1, c2, text, o) => { ws.mergeCells(r, c1, r, c2); const cell = ws.getCell(r, c1); cell.value = text; style(cell, Object.assign({ font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }, fill: GREEN, border: false }, o || {})); };
  const protect = (ws, extra) => ws.protect('', Object.assign({ selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, autoFilter: true, sort: false }, extra || {}));

  /* ---------- ورقة الشعبة ---------- */
  function addSection(wb, sec, ctx) {
    const crn = sec.crn, ws = wb.addWorksheet(crn, { views: [{ rightToLeft: true, state: 'frozen', xSplit: 3, ySplit: 5, showGridLines: false }], properties: { tabColor: { argb: BLUE } } });
    sheetBase(ws, true);
    const parts = G.parts(sec), its = sec.items || {}, marks = gMarks(crn), sub = ((A.raw.gmarks[crn] || {}).s) || {}, rows = gElFirst(sec.rows);   // غير القابلين للرصد في آخر الورقة
    const cols = [{ h: 'م', w: 5 }, { h: 'الرقم التدريبي', w: 13 }, { h: 'اسم المتدرب', w: 36 }, { h: 'حالة القيد في رايات', w: 19 }, { h: 'قابل للرصد', w: 9 }];
    const inputs = [], comps = [], partCols = [];
    Object.keys(parts).forEach((p) => {
      const pc = [], start = cols.length + 1;
      parts[p].forEach((c) => {
        const itemCols = [];
        (its[c.k] || []).forEach((it) => { cols.push({ h: `${it.n} (${G.fmt(it.max)})`, w: 10, input: true, max: it.max, k: c.k, item: it.n }); itemCols.push(cols.length); inputs.push(cols.length); });
        cols.push({ h: `${c.k} ${compLabel(c)} (${G.fmt(c.max)})`, w: 13, input: !its[c.k], max: c.max, k: c.k, items: itemCols, comp: true });
        if (!its[c.k]) inputs.push(cols.length);
        comps.push(cols.length); pc.push(cols.length);
      });
      cols.push({ h: `مجموع ${p.startsWith('ال') ? p : 'ال' + p} (${G.fmt(parts[p].reduce((a, c) => a + c.max, 0))})`, w: 12, part: p, of: pc });
      partCols.push({ p, col: cols.length, start, end: cols.length });
    });
    cols.push({ h: `المجموع (${G.fmt(G.total(sec))})`, w: 11, total: true });
    const totC = cols.length;
    cols.push({ h: 'التقدير', w: 8, grade: true }); const grC = cols.length;
    cols.push({ h: 'الحالة', w: 15, status: true }); const stC = cols.length;
    cols.push({ h: 'أخطاء الإدخال', w: 6, helper: true }); const hpC = cols.length;
    const N = cols.length, H = 5, R0 = 6, R1 = R0 + rows.length - 1;
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });
    ws.getColumn(hpC).hidden = true;
    title(ws, 1, 1, N - 1, `نموذج إدخال الدرجات — ${sec.code} ${sec.name} — الشعبة ${crn}`);
    ws.getRow(1).height = 26;
    ws.mergeCells(2, 1, 2, N - 1); const c2 = ws.getCell(2, 1);
    c2.value = `${ORGL} • المدرب: ${ctx.trainerName} • ${sec.term || ''} • المتدربون: ${rows.length}، القابلون للرصد: ${rows.filter((r) => r.el).length} • معرّف المصنف: ${ctx.id}`;
    style(c2, { font: { size: 10, color: { argb: 'FF333333' } }, fill: LGREEN, border: false });
    ws.mergeCells(3, 1, 3, N - 1); const c3 = ws.getCell(3, 1);
    c3.value = 'أدخل الدرجات في الخلايا الصفراء فقط. المجاميع والتقدير والحالة تُحسب آلياً، والخلية الفارغة لا تُحسب صفراً. لا تغيّر عناوين الأعمدة ولا اسم الورقة ولا الأرقام التدريبية.';
    style(c3, { font: { size: 10, color: { argb: 'FF7A4B00' } }, fill: 'FFFFF4D6', border: false });
    ws.getRow(2).height = 20; ws.getRow(3).height = 30;
    /* صف الأجزاء */
    for (let j = 1; j <= 5; j++) style(ws.getCell(4, j), { fill: GREEN });
    partCols.forEach((x) => { if (x.end > x.start) ws.mergeCells(4, x.start, 4, x.end); const c = ws.getCell(4, x.start); c.value = `الجزء ${x.p.replace(/^ال/, '')} (${G.fmt(parts[x.p].reduce((a, k) => a + k.max, 0))})`; style(c, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: BLUE }); });
    for (let j = totC; j < N; j++) style(ws.getCell(4, j), { fill: GREEN });
    /* العناوين */
    cols.forEach((c, i) => { const cell = ws.getCell(H, i + 1); cell.value = c.h; style(cell, { font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }, fill: c.input ? BLUE : GREEN }); });
    ws.getRow(H).height = 44;
    /* الصفوف */
    rows.forEach((r, i) => {
      const R = R0 + i, A = (j) => colL(j) + R, rowSub = sub[r.id] || {};
      const set = (j, v, o) => { const cell = ws.getCell(R, j); cell.value = v; style(cell, o || {}); return cell; };
      const base = r.el ? {} : { fill: GREY, font: { color: { argb: 'FF8A8A8A' } } };
      set(1, i + 1, base); set(2, r.id, Object.assign({ fmt: '@' }, base)); set(3, r.name, Object.assign({ al: { horizontal: 'right' } }, base)); set(4, r.st || '', Object.assign({ font: { size: 10 } }, base)); set(5, r.el ? 'نعم' : 'لا', base);
      const bad = [];
      cols.forEach((c, j0) => {
        const j = j0 + 1;
        if (j <= 5) return;
        if (c.input) {
          const saved = ctx.withGrades && r.el ? (c.item ? (rowSub[c.k] || {})[c.item] : G.val(marks, r.id, c.k)) : null;
          const cell = set(j, G.isNum(saved) ? saved : null, Object.assign({ fill: r.el ? INPUT : GREY, fmt: '0.##' }, r.el ? {} : { font: { color: { argb: 'FF8A8A8A' } } }));
          if (r.el) {
            cell.protection = { locked: false };
            cell.dataValidation = { type: 'custom', allowBlank: true, formulae: [`AND(ISNUMBER(${A(j)}),${A(j)}>=0,${A(j)}<=${c.max},ROUND(${A(j)},2)=${A(j)})`], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'درجة غير صحيحة', error: `أدخل رقماً من 0 إلى ${G.fmt(c.max)} بخانتين عشريتين على الأكثر.`, showInputMessage: true, promptTitle: c.item ? `${c.item} — ${c.k}` : c.k, prompt: `الحد الأعلى ${G.fmt(c.max)}` };
            bad.push(`IF(${A(j)}="",0,IF(ISNUMBER(${A(j)}),IF(AND(${A(j)}>=0,${A(j)}<=${c.max},ROUND(${A(j)},2)=${A(j)}),0,1),1))`);
          }
          return;
        }
        if (c.comp) {   // مكوّن له بنود: مجموعها عند اكتمالها
          const rng = `${colL(c.items[0])}${R}:${colL(c.items[c.items.length - 1])}${R}`, saved = ctx.withGrades && r.el ? G.val(marks, r.id, c.k) : null, hasSub = Object.keys(rowSub[c.k] || {}).length;
          set(j, r.el ? { formula: `IF(COUNT(${rng})=${c.items.length},SUM(${rng}),${G.isNum(saved) && !hasSub ? saved : '""'})` } : null, { fill: r.el ? LGREEN : GREY, font: { bold: true }, fmt: '0.##' });
          return;
        }
        if (c.part) { const refs = c.of.map((x) => A(x)).join(','); set(j, r.el ? { formula: `IF(COUNT(${refs})=${c.of.length},SUM(${refs}),"")` } : null, { fill: r.el ? LBLUE : GREY, font: { bold: true }, fmt: '0.##' }); return; }
        if (c.total) { const refs = partCols.map((x) => A(x.col)).join(','); set(j, r.el ? { formula: `IF(OR(${A(hpC)}>0,COUNT(${refs})<${partCols.length}),"",SUM(${refs}))` } : null, { fill: r.el ? LGREEN : GREY, font: { bold: true, size: 12 }, fmt: '0.##' }); return; }
        if (c.grade) { set(j, r.el ? { formula: `IF(${A(totC)}="","",LOOKUP(${A(totC)},${q('الإعدادات')}!$A$6:$A$14,${q('الإعدادات')}!$B$6:$B$14))` } : null, { font: { bold: true }, fill: r.el ? 'FFFFFFFF' : GREY }); return; }
        if (c.status) {
          const ins = inputs.map((x) => A(x)), cnt = ins.map((x) => `COUNTA(${x})`).join('+');
          set(j, { formula: r.el ? `IF(${A(hpC)}>0,"خطأ في الإدخال",IF(${A(totC)}<>"","مكتمل",IF(${cnt}=0,"لم يبدأ","ناقص")))` : '"غير قابل للرصد"' }, { font: { bold: true, size: 10 }, fill: r.el ? 'FFFFFFFF' : GREY });
          return;
        }
        if (c.helper) set(j, r.el ? { formula: bad.length ? bad.join('+') : '0' } : 0, {});
      });
    });
    /* تنسيق شرطي */
    if (rows.length) {
      inputs.forEach((j) => {
        const L = colL(j), ref = `${L}${R0}:${L}${R1}`, c0 = `${L}${R0}`, mx = cols[j - 1].max;
        ws.addConditionalFormatting({ ref, rules: [
          { type: 'expression', priority: 1, formulae: [`AND(${c0}<>"",IF(ISNUMBER(${c0}),OR(${c0}<0,${c0}>${mx},ROUND(${c0},2)<>${c0}),TRUE))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } } },
          { type: 'expression', priority: 2, formulae: [`AND($E${R0}="نعم",${c0}="")`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFCE4D6' } } } },
          { type: 'expression', priority: 3, formulae: [`AND($E${R0}="نعم",ISNUMBER(${c0}))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE2F0D9' } } } },
        ] });
      });
      const sref = `${colL(stC)}${R0}:${colL(stC)}${R1}`, s0 = `${colL(stC)}${R0}`;
      ws.addConditionalFormatting({ ref: sref, rules: [
        { type: 'expression', priority: 4, formulae: [`${s0}="مكتمل"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } }, font: { color: { argb: 'FF006100' } } } },
        { type: 'expression', priority: 5, formulae: [`${s0}="ناقص"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C5700' } } } },
        { type: 'expression', priority: 6, formulae: [`${s0}="خطأ في الإدخال"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' } } } },
      ] });
      ws.addConditionalFormatting({ ref: `B${R0}:B${R1}`, rules: [{ type: 'expression', priority: 7, formulae: [`COUNTIF($B$${R0}:$B$${R1},B${R0})>1`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } } } }] });
      ws.autoFilter = { from: { row: H, column: 1 }, to: { row: R1, column: stC } };
    }
    /* سطر الحدود والمتوسط */
    const RL = R1 + 2;
    ws.getCell(RL, 3).value = 'متوسط الشعبة'; style(ws.getCell(RL, 3), { font: { bold: true }, fill: LGREEN });
    cols.forEach((c, j0) => { const j = j0 + 1; if (j > 5 && j < grC && rows.length) { const L = colL(j); const cell = ws.getCell(RL, j); cell.value = { formula: `IFERROR(ROUND(AVERAGE(${L}${R0}:${L}${R1}),2),"")` }; style(cell, { fill: LGREEN, fmt: '0.##' }); } });
    ws.getCell(RL + 1, 3).value = 'الحد الأعلى'; style(ws.getCell(RL + 1, 3), { font: { bold: true }, fill: GREY });
    cols.forEach((c, j0) => { const j = j0 + 1; if (j > 5 && j < grC) { const cell = ws.getCell(RL + 1, j); cell.value = c.max != null ? c.max : c.part ? parts[c.part].reduce((a, k) => a + k.max, 0) : c.total ? G.total(sec) : null; style(cell, { fill: GREY, fmt: '0.##' }); } });
    protect(ws);
    const rng = (j) => `${q(crn)}!$${colL(j)}$${R0}:$${colL(j)}$${Math.max(R1, R0)}`;
    return { crn, sec, n: rows.length, el: rows.filter((r) => r.el).length, inputs: inputs.map(rng), status: rng(stC), total: rng(totC), elRange: rng(5) };
  }

  /* ---------- الصفحة الرئيسية ---------- */
  function addHome(wb, ctx, infos) {
    const ws = wb.getWorksheet('الرئيسية');
    const secs = infos.map((x) => x.sec), courses = [...new Set(secs.map((s) => `${s.code} ${s.name}`))];
    [6, 22, 14, 14, 14, 14, 14, 14, 14, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    title(ws, 1, 1, 10, 'منصة حاضر — نموذج إدخال الدرجات', { font: { bold: true, size: 18, color: { argb: 'FFFFFFFF' } } }); ws.getRow(1).height = 34;
    ws.mergeCells(2, 1, 2, 10); const o = ws.getCell(2, 1); o.value = `${ORGL} — قسم الحاسب وتقنية المعلومات`; style(o, { font: { bold: true, color: { argb: GREEN } }, fill: LGREEN, border: false }); ws.getRow(2).height = 22;
    const info = [['اسم المدرب', ctx.trainerName], ['الكلية', 'الكلية التقنية ببيشة'], ['المقرر', courses.join('، ')], ['الفصل التدريبي', ctx.term], ['العام التدريبي', termYear(ctx.term)], ['معرّف المصنف', ctx.id], ['تاريخ الإنشاء', ctx.atText]];
    info.forEach(([k, v], i) => { const R = 4 + i; ws.mergeCells(R, 1, R, 2); ws.mergeCells(R, 3, R, 6); ws.getCell(R, 1).value = k; ws.getCell(R, 3).value = v; style(ws.getCell(R, 1), { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: BLUE }); style(ws.getCell(R, 3), { al: { horizontal: 'right' }, fill: 'FFFFFFFF' }); });
    /* الجدول التفصيلي (مصدر المؤشرات والرسمين) */
    const T = 21, head = ['م', 'الشعبة', 'المقرر', 'المتدربون', 'القابلون للرصد', 'الدرجات المدخلة', 'الدرجات المطلوبة', 'مكتملون', 'لم تكتمل درجاتهم', 'نسبة الاكتمال', 'متوسط المجموع'];
    ws.getColumn(11).width = 14;
    title(ws, T - 1, 1, 11, 'حالة إدخال الدرجات لكل شعبة', { font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }, fill: BLUE });
    head.forEach((h, i) => { const c = ws.getCell(T, i + 1); c.value = h; style(c, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: GREEN }); });
    infos.forEach((x, i) => {
      const R = T + 1 + i, cnt = x.inputs.map((r) => `COUNT(${r})`).join('+') || '0';
      const vals = [i + 1, x.crn, `${x.sec.code} ${x.sec.name}`, x.n, { formula: `COUNTIF(${x.elRange},"نعم")` }, { formula: cnt }, { formula: `E${R}*${x.inputs.length}` }, { formula: `COUNTIF(${x.status},"مكتمل")` }, { formula: `E${R}-H${R}` }, { formula: `IF(G${R}=0,0,F${R}/G${R})` }, { formula: `IFERROR(ROUND(AVERAGE(${x.total}),2),"")` }];
      vals.forEach((v, j) => { const c = ws.getCell(R, j + 1); c.value = v; style(c, { fmt: j === 9 ? '0%' : j === 10 ? '0.##' : undefined, fill: i % 2 ? 'FFF7FAF8' : 'FFFFFFFF', font: j === 1 ? { bold: true } : {} }); });
    });
    const R1 = T + infos.length, RT = R1 + 1;
    ws.getCell(RT, 2).value = 'الإجمالي'; style(ws.getCell(RT, 2), { font: { bold: true }, fill: LGREEN }); style(ws.getCell(RT, 1), { fill: LGREEN }); style(ws.getCell(RT, 3), { fill: LGREEN });
    ['D', 'E', 'F', 'G', 'H', 'I'].forEach((L) => { const c = ws.getCell(`${L}${RT}`); c.value = { formula: `SUM(${L}${T + 1}:${L}${R1})` }; style(c, { font: { bold: true }, fill: LGREEN }); });
    const pc = ws.getCell(`J${RT}`); pc.value = { formula: `IF(G${RT}=0,0,F${RT}/G${RT})` }; style(pc, { font: { bold: true }, fill: LGREEN, fmt: '0%' });
    const av = ws.getCell(`K${RT}`); av.value = { formula: `IFERROR(ROUND(AVERAGE(${infos.map((x) => x.total).join(',')}),2),"")` }; style(av, { font: { bold: true }, fill: LGREEN, fmt: '0.##' });
    ws.addConditionalFormatting({ ref: `J${T + 1}:J${R1}`, rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF63BE7B' } }] });
    /* بطاقات المؤشرات */
    const cards = [['عدد الشعب', { formula: `COUNTA(B${T + 1}:B${R1})` }, '0'], ['إجمالي المتدربين', { formula: `D${RT}` }, '0'], ['القابلون للرصد', { formula: `E${RT}` }, '0'], ['الدرجات المدخلة', { formula: `F${RT}` }, '0'], ['لم تكتمل درجاتهم', { formula: `I${RT}` }, '0'], ['متوسط المجموع', { formula: `K${RT}` }, '0.##'], ['نسبة الاكتمال', { formula: `J${RT}` }, '0%']];
    const CR = 12; ws.getRow(CR).height = 22; ws.getRow(CR + 1).height = 38;
    cards.forEach(([k, v, f], i) => {
      const c1 = 1 + i + (i > 0 ? 1 : 0) + (i > 0 ? i - 1 : 0) * 0;   // أعمدة: 1، 3..8 (العمود 2 عريض)
      const col = i === 0 ? 1 : i + 2; const span = i === 0 ? 2 : 1;
      if (span > 1) { ws.mergeCells(CR, col, CR, col + 1); ws.mergeCells(CR + 1, col, CR + 1, col + 1); }
      const h = ws.getCell(CR, col), b = ws.getCell(CR + 1, col); h.value = k; b.value = v;
      style(h, { font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }, fill: i === 6 ? GREEN : BLUE });
      style(b, { font: { bold: true, size: 18, color: { argb: i === 4 ? 'FFC00000' : GREEN } }, fill: LGREEN, fmt: f });
      void c1;
    });
    ws.mergeCells(CR + 2, 1, CR + 2, 10); const n = ws.getCell(CR + 2, 1);
    n.value = 'تتحدث المؤشرات تلقائياً عند إدخال الدرجات في أوراق الشعب. «الدرجات المدخلة» عدد خلايا الدرجات المعبأة، و«نسبة الاكتمال» = المدخلة ÷ المطلوبة للقابلين للرصد.';
    style(n, { font: { size: 9, color: { argb: 'FF555555' } }, border: false, al: { horizontal: 'right' } });
    ws.views = [{ rightToLeft: true, showGridLines: false }];
    sheetBase(ws, false);
    protect(ws);
    return { T, R1, rows: infos.length, chartRow: RT + 2 };
  }

  function addInstructions(wb) {
    const ws = wb.addWorksheet('التعليمات', { views: [{ rightToLeft: true, showGridLines: false }], properties: { tabColor: { argb: GREEN } } });
    ws.getColumn(1).width = 5; ws.getColumn(2).width = 110;
    title(ws, 1, 1, 2, 'تعليمات استخدام نموذج إدخال الدرجات');
    const L = [
      ['دورة العمل', 'منصة حاضر ← تحميل Excel ← إدخال الدرجات ← رفع Excel ← معاينة ← اعتماد ← حفظ في قاعدة البيانات.'],
      ['1', 'نزّل النموذج من منصة حاضر: «إدخال درجات المتدربين» ← «تحميل نموذج إدخال الدرجات Excel». يحتوي شعبك المسندة إليك بقوائمها وتوزيع درجاتها المعتمد، ودرجاتك المحفوظة إن وجدت.'],
      ['2', 'لكل شعبة ورقة اسمها رقم الشعبة. أدخل الدرجات في الخلايا الصفراء فقط. الخلايا الأخرى محمية (بلا كلمة مرور) حتى لا تتغير بالخطأ.'],
      ['3', 'لا تُقبل إلا الأرقام من صفر إلى الحد الأعلى بخانتين عشريتين على الأكثر. الخلية الخاطئة تظهر بالأحمر وحالة المتدرب «خطأ في الإدخال»، والفارغة للقابل للرصد بالبرتقالي.'],
      ['4', 'أعمال الفصل (LEC1 / LAB1) تُحسب من بنودها (الواجبات، المشاركة، الشهري 1، الشهري 2) عند اكتمالها كلها، والمجموع والتقدير والحالة تُحسب آلياً. الخلية الفارغة لا تُحسب صفراً.'],
      ['5', 'المتدرب غير القابل للرصد (حرمان أو طي قيد) خلاياه رمادية مقفلة، ولا تُستورد له درجات.'],
      ['6', 'احفظ الملف في Excel ثم ارفعه من المنصة: «استيراد درجات Excel». اختر شعبة واحدة أو كل الشعب، وحدد هل تُحدَّث الدرجات المحفوظة سابقاً.'],
      ['7', 'تعرض المنصة معاينة قبل الحفظ: الدرجات الجديدة، والمخالفة للمحفوظ بقيمتها القديمة والجديدة، والمرفوضة بأسبابها مع تقرير أخطاء قابل للتنزيل. لا يُحفظ شيء قبل «اعتماد الاستيراد».'],
      ['8', 'الحفظ يتم على الخادم بعد التحقق من صلاحيتك على الشعبة ومن كل درجة. تُسجَّل العملية باسمك ووقتها، ويمكن التراجع عنها من «سجل استيراد الدرجات» ما لم تُعدَّل الدرجات بعدها.'],
      ['9', 'للمصنف معرّف خاص بالفصل التدريبي والمدرب والشعب. لا يُقبل مصنف فصل سابق أو مصنف مدرب آخر، وإن تغيّرت قائمة الشعبة أو توزيعها بعد التنزيل تنبهك المنصة لتنزيل نموذج جديد.'],
      ['10', 'لا تغيّر أسماء الأوراق ولا عناوين الأعمدة ولا الأرقام التدريبية، ولا تحذف الورقة الخفية الخاصة بالمعرّف.'],
      ['11', 'توزيع الدرجات يُعتمد من «إعدادات توزيع الدرجات» في المنصة لأنه مرجع الرصد في رايات، ثم يُنزَّل نموذج جديد. سلم التقديرات في ورقة «الإعدادات» قابل للتعديل ويؤثر على عمود التقدير في المصنف فقط.'],
      ['12', 'لتعديل درجات محفوظة: نزّل النموذج من المنصة (يأتي بالدرجات الحالية)، عدّل، ثم ارفعه مع خيار «تحديث الدرجات السابقة». لا تُحذف درجة محفوظة بترك خليتها فارغة.'],
    ];
    L.forEach(([a, b], i) => { const R = 3 + i, c1 = ws.getCell(R, 1), c2 = ws.getCell(R, 2); c1.value = a; c2.value = b; style(c1, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: i ? BLUE : GREEN }); style(c2, { al: { horizontal: 'right' }, font: i ? {} : { bold: true, color: { argb: GREEN } }, fill: i ? 'FFFFFFFF' : LGREEN }); ws.getRow(R).height = i ? 34 : 26; });
    sheetBase(ws, false); protect(ws);
  }

  function addDist(wb, secs) {
    const ws = wb.addWorksheet('توزيع الدرجات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }], properties: { tabColor: { argb: GREEN } } });
    const head = ['م', 'الرقم المرجعي', 'رمز المقرر', 'اسم المقرر', 'رمز المكون', 'وصف المكون', 'الجزء', 'الدرجة القصوى', 'يجب الاجتياز', 'البنود التفصيلية'];
    [5, 12, 12, 26, 11, 34, 9, 12, 11, 48].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    title(ws, 1, 1, head.length, 'توزيع الدرجات المعتمد في منصة حاضر');
    ws.mergeCells(2, 1, 2, head.length); ws.getCell(2, 1).value = 'هذا التوزيع مرجع للتحقق ولا يُعدَّل هنا: يُعتمد من «إعدادات توزيع الدرجات» في المنصة، ثم يُنزَّل نموذج جديد.'; style(ws.getCell(2, 1), { font: { size: 10, color: { argb: 'FF7A4B00' } }, fill: 'FFFFF4D6', border: false });
    head.forEach((h, i) => { const c = ws.getCell(4, i + 1); c.value = h; style(c, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: GREEN }); });
    let R = 5;
    secs.forEach((s) => G.comps(s).forEach((c) => { const it = (s.items || {})[c.k]; [R - 4, s.crn, s.code, s.name, c.k, c.desc || '', c.part || '', c.max, c.mustPass || '', it ? it.map((x) => `${x.n} ${G.fmt(x.max)}`).join(' + ') : ''].forEach((v, j) => { const cell = ws.getCell(R, j + 1); cell.value = v; style(cell, { al: j === 5 || j === 9 || j === 3 ? { horizontal: 'right' } : {} }); }); R++; }));
    sheetBase(ws, true); protect(ws);
  }

  function addSettings(wb) {
    const ws = wb.addWorksheet('الإعدادات', { views: [{ rightToLeft: true, showGridLines: false }], properties: { tabColor: { argb: BLUE } } });
    [16, 12, 22, 60].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    title(ws, 1, 1, 4, 'إعدادات المصنف: سلم التقديرات');
    ws.mergeCells(2, 1, 3, 4); ws.getCell(2, 1).value = 'السلم الافتراضي المستخدم في الكليات التقنية. راجعه مع اللائحة المعتمدة وعدّل الخلايا الصفراء عند الحاجة (الحد الأدنى تصاعدياً). يؤثر على عمود «التقدير» في المصنف فقط، ولا يُرفع إلى رايات.';
    style(ws.getCell(2, 1), { font: { size: 10, color: { argb: 'FF7A4B00' } }, fill: 'FFFFF4D6', border: false, al: { horizontal: 'right' } });
    ['الحد الأدنى', 'التقدير', 'الوصف'].forEach((h, i) => { const c = ws.getCell(5, i + 1); c.value = h; style(c, { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: GREEN }); });
    SCALE.forEach((r, i) => r.forEach((v, j) => { const c = ws.getCell(6 + i, j + 1); c.value = v; style(c, { fill: INPUT }); c.protection = { locked: false }; if (j === 0) c.dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 100], allowBlank: false, showErrorMessage: true, errorTitle: 'قيمة غير صحيحة', error: 'الحد الأدنى رقم من 0 إلى 100.' }; }));
    sheetBase(ws, false); protect(ws);
  }

  /* ---------- الرسوم البيانية: تُضاف إلى ملف xlsx مباشرة ---------- */
  function chartXml(o) {
    const pts = (arr, num) => arr.map((v, i) => `<c:pt idx="${i}"><c:v>${num ? (G.isNum(v) ? v : '') : xe(v)}</c:v></c:pt>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="ar-SA" sz="1200" b="1"><a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:rPr><a:t>${xe(o.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${xe(o.name)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${o.color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/><c:dLbls><c:numFmt formatCode="${o.fmt}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:cat><c:strRef><c:f>${xe(o.cat)}</c:f><c:strCache><c:ptCount val="${o.cats.length}"/>${pts(o.cats)}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${xe(o.val)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${o.vals.length}"/>${pts(o.vals, true)}</c:numCache></c:numRef></c:val></c:ser><c:gapWidth val="70"/><c:axId val="${o.ax}1"/><c:axId val="${o.ax}2"/></c:barChart><c:catAx><c:axId val="${o.ax}1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${o.ax}2"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="${o.ax}2"/><c:scaling><c:orientation val="minMax"/>${o.max != null ? `<c:max val="${o.max}"/>` : ''}<c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${o.fmt}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${o.ax}1"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
  }
  const anchor = (id, c1, r1, c2, r2) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="Chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${id}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  async function addCharts(buf, home, infos) {
    const zip = await window.JSZip.loadAsync(buf), H = q('الرئيسية'), T = home.T, R1 = home.R1, r0 = home.chartRow - 1;
    const st = infos.map((x) => { const s = G.stats(x.sec, gMarks(x.crn)); const req = x.el * x.inputs.length; return { avg: s.avg != null ? s.avg : null, pct: req ? Math.min(1, (x.filled || 0) / req) : 0 }; });
    const charts = [
      chartXml({ title: 'نسبة اكتمال إدخال الدرجات لكل شعبة', name: 'نسبة الاكتمال', color: '006C35', fmt: '0%', max: 1, ax: 501, cat: `${H}!$B$${T + 1}:$B$${R1}`, val: `${H}!$J$${T + 1}:$J$${R1}`, cats: infos.map((x) => x.crn), vals: st.map((x) => x.pct) }),
      chartXml({ title: 'متوسط مجموع الدرجات لكل شعبة', name: 'متوسط المجموع', color: '1F5AA6', fmt: '0.#', max: 100, ax: 601, cat: `${H}!$B$${T + 1}:$B$${R1}`, val: `${H}!$K$${T + 1}:$K$${R1}`, cats: infos.map((x) => x.crn), vals: st.map((x) => x.avg) }),
    ];
    charts.forEach((x, i) => zip.file(`xl/charts/chart${i + 1}.xml`, x));
    zip.file('xl/drawings/drawing1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchor(1, 0, r0, 5, r0 + 18)}${anchor(2, 5, r0, 11, r0 + 18)}</xdr:wsDr>`);
    zip.file('xl/drawings/_rels/drawing1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/></Relationships>`);
    const relP = 'xl/worksheets/_rels/sheet1.xml.rels', relX = zip.file(relP) ? await zip.file(relP).async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    zip.file(relP, relX.replace('</Relationships>', '<Relationship Id="rIdHChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'));
    let sx = await zip.file('xl/worksheets/sheet1.xml').async('string');
    if (!/xmlns:r=/.test(sx.slice(0, 600))) sx = sx.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    const at = ['<legacyDrawing', '<legacyDrawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>'].map((t) => sx.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    sx = sx.slice(0, at) + '<drawing r:id="rIdHChart"/>' + sx.slice(at);
    zip.file('xl/worksheets/sheet1.xml', sx);
    let ct = await zip.file('[Content_Types].xml').async('string');
    ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>');
    zip.file('[Content_Types].xml', ct);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }

  /* ---------- بناء المصنف ---------- */
  async function build(crns, opts) {
    await loadLibs();
    const secs = crns.map((c) => A.raw.gsec[c]).filter(Boolean).sort((a, b) => a.crn.localeCompare(b.crn));
    if (!secs.length) throw new HErrLocal('لا توجد شعب درجات لهذا الحساب.');
    const now = new Date(), term = secs[0].term || '', tkey = (secs[0].termCode || (term.match(/(1[34]\d{2})/) || [])[1] || 'T') + (/الأول/.test(term) ? '1' : /الثاني/.test(term) ? '2' : /الصيفي|الثالث/.test(term) ? '3' : '');
    const id = `HGB-${tkey}-${A.me.id.slice(-6)}-${now.getTime().toString(36).toUpperCase()}`;
    const ctx = { id, term, trainerName: A.me.name || '', withGrades: opts.withGrades !== false, atText: now.toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }) };
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'منصة حاضر'; wb.company = 'الكلية التقنية ببيشة'; wb.title = 'نموذج إدخال الدرجات'; wb.created = now;
    wb.calcProperties.fullCalcOnLoad = true;
    wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
    wb.addWorksheet('الرئيسية', { properties: { tabColor: { argb: GREEN } } });
    addInstructions(wb);
    const infos = secs.map((s) => { const x = addSection(wb, s, ctx); const m = gMarks(s.crn), sub = ((A.raw.gmarks[s.crn] || {}).s) || {}; x.filled = ctx.withGrades ? (s.rows || []).filter((r) => r.el).reduce((a, r) => a + G.comps(s).reduce((b, c) => b + ((s.items || {})[c.k] ? Object.values((sub[r.id] || {})[c.k] || {}).filter(G.isNum).length : (G.isNum(G.val(m, r.id, c.k)) ? 1 : 0)), 0), 0) : 0; return x; });
    const home = addHome(wb, ctx, infos);
    addDist(wb, secs); addSettings(wb);
    const meta = { app: 'haader-grades', v: 1, id, term, termCode: secs[0].termCode || '', trainer: A.me.id, trainerName: A.me.name || '', at: now.toISOString(), crns: secs.map((s) => s.crn), sigs: Object.fromEntries(secs.map((s) => [s.crn, secSig(s)])), withGrades: ctx.withGrades };
    const mws = wb.addWorksheet('_haader', { state: 'veryHidden' });
    mws.getCell('A1').value = 'haader-grades'; mws.getCell('A2').value = JSON.stringify(meta);
    mws.protect('', {});
    const buf = await wb.xlsx.writeBuffer();
    const blob = await addCharts(buf, home, infos);
    return { blob, meta };
  }
  function HErrLocal(m) { this.message = m; }
  async function download(crns, opts) {
    toast('جارٍ إنشاء المصنف…');
    let r; try { r = await build(crns, opts || {}); } catch (e) { toast(e && e.message && /[؀-ۿ]/.test(e.message) ? e.message : 'تعذر إنشاء المصنف. أعد المحاولة.'); console.error(e); return null; }
    const name = (opts && opts.name) || `نموذج إدخال الدرجات - ${r.meta.crns.length === 1 ? 'الشعبة ' + r.meta.crns[0] : r.meta.crns.length + ' شعب'} - ${r.meta.id}.xlsx`;
    await save(name, r.blob);
    gLog([['tpl', r.meta.crns.join('،'), '', '', '', '', `تنزيل نموذج إدخال الدرجات ${r.meta.id} (${r.meta.crns.length} شعبة${r.meta.withGrades ? '، بالدرجات المحفوظة' : ''})`]]);
    return r.meta;
  }
  const mine = () => gSecs().map((s) => s.crn).filter((c) => gMay(c));
  window.HAADER_GX = { build, download, secSig, mine, SCALE };
})();
