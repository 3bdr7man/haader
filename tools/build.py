#!/usr/bin/env python3
"""يبني index.html من الإصدار 20 المنشور + قسم الدرجات (CSS، الوحدة، الجسر)."""
import re, subprocess, sys, pathlib
R = pathlib.Path('/home/claude/work')
s = (R/'app/index.v20.html').read_text(encoding='utf8')
src = lambda n: (R/'src'/n).read_text(encoding='utf8')

# 1) CSS: يُلحق بآخر ورقة الأنماط
css = src('modal.css') + '\n' + src('h2.css') + '\n' + src('h3.css') + '\n' + src('grades.css')
mark = '</style>\n<div id="gate"'
assert s.count(mark) == 1
s = s.replace(mark, '\n' + css + mark)

# 2) الجسر: نسخة 2 تعرّف واجهة مشتركة وتوجّه حزمة الدرجات
m = re.search(r'(<script type="text/plain" id="bridge-src">)(.*?)(</script>)', s, re.S)
b = m.group(2)
def rep(old, new):
    global b
    assert b.count(old) == 1, (b.count(old), old[:70])
    b = b.replace(old, new)
rep('if(window.__HB&&window.__HB.show)window.__HB.show();else{', 'if(window.__HB&&window.__HB.show&&window.__HB.v>=2)window.__HB.show();else{')
rep('window.__HB={show:R,compare:x,civil:f,stateOf:g,facultySections:m},R()', 'window.__HB={v:2,show:R,compare:x,civil:f,stateOf:g,facultySections:m,ui:{el:y,btn:C,clear:k,copy:S,dump:D,d:d,back:E}},R()')
rep('try{if("haader"!==(s=JSON.parse(t.value.trim())).app)throw 0;', 'try{var q=JSON.parse(t.value.trim());if("haader-grades"===q.app&&window.__HBG)return void window.__HBG.run(q);if("haader"!==(s=q).app)throw 0;')
rep('d.root=y("div"),d.root.id="hb";', '(function(){var o=document.getElementById("hb");o&&o.parentNode.removeChild(o)})(),d.root=y("div"),d.root.id="hb";')
rep('"الصق هنا حزمة المزامنة التي نسختها من منصة حاضر."', '"الصق هنا حزمة التحضير أو حزمة الدرجات التي نسختها من منصة حاضر."')
rep('window.alert("اضغط الجسر داخل صفحة متابعة الحضور في رايات، أو داخل نموذج «تسجيل الحضور» في Forms.")', 'window.alert("اضغط الجسر داخل صفحة رايات (متابعة الحضور أو إدخال الدرجات)، أو داخل نموذج «تسجيل الحضور» في Forms.")')
gb = src('gbridge.min.js').strip()
assert '</script' not in gb and '</script' not in b
b = b.rstrip()
b = b + (';' if not b.endswith(';') else '') + gb
(R/'src/bridge.full.js').write_text(b, encoding='utf8')
s = s[:m.start(2)] + b + s[m.end(2):]

# 3) الوحدة: قبل boot() في السكربت الرئيسي
mod = '\n'.join(src(n) for n in ['g1-engine.js', 'g2-data.js', 'g3a-views.js', 'g3b-views.js', 'g3c-views.js', 'g4-actions.js', 'g5-accounts.js', 'h1-core.js', 'g0-ui.js', 'h2-ui.js', 'h3-polish.js'])
assert '</script' not in mod
i = s.rindex('\nboot();\n')
s = s[:i] + '\n\n' + mod + '\n' + s[i:]
(R/'out').mkdir(exist_ok=True)
(R/'out/index.html').write_text(s, encoding='utf8')
# فحص نحوي للسكربت الرئيسي
j = s.index('<script>\nconst LOGO=') + len('<script>')
e = s.index('</script>', i)
(R/'out/main.check.js').write_text(s[j:e], encoding='utf8')
print('index.html', len(s.encode('utf8')), 'bytes; module', len(mod.encode('utf8')), 'bytes; bridge', len(b.encode('utf8')))
r = subprocess.run(['node', '--check', str(R/'out/main.check.js')], capture_output=True, text=True); print('main syntax:', 'ok' if r.returncode == 0 else r.stderr[:800])
(R/'out/bridge.check.js').write_text(b, encoding='utf8')
r = subprocess.run(['node', '--check', str(R/'out/bridge.check.js')], capture_output=True, text=True); print('bridge syntax:', 'ok' if r.returncode == 0 else r.stderr[:800])
