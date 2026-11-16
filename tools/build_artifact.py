#!/usr/bin/env python3
"""يبني نسخة Claude من منصة حاضر (dist/artifact/index.html) من index.html.

قاعدة المشروع: كل تحديث يُطبَّق على النسختين معاً — نسخة الويب (tools/build_web.py)
ونسخة Claude (هذا الملف). الطبقات المشتركة بين النسختين:
  - src/web/grades-web.js  استيراد الدرجات من Excel ومعاينته وسجله والتراجع عنه
                           (الحفظ عبر الخادم في الويب، وعبر قاعدة بيانات المنصة في Claude)
  - src/web/grades-xl.js   نموذج إدخال الدرجات Excel (مكتبتا ExcelJS وJSZip من docs/vendor)
  - src/web/theme-v2.css/.js  المظهر المطوّر
  - src/web/grades.css     أنماط خيارات الاستيراد
ولا تُضاف طبقات الويب الخاصة (الاتصال بالخادم، شاشة الدخول، بوابة المتدرب).

الاستخدام: python3 tools/build_artifact.py
ثم يُنشر dist/artifact/index.html إلى المنصة في Claude مع ملفات vendor/.
"""
import pathlib, shutil, subprocess, sys, tempfile

R = pathlib.Path(__file__).resolve().parent.parent
s = (R / 'index.html').read_text(encoding='utf8')
web = lambda n: (R / 'src/web' / n).read_text(encoding='utf8')

# index.html محفوظ بهيكل الصفحة الذي تضيفه Claude عند النشر؛ تُنشر الصفحة من محتواها فقط
i = s.find('<title>منصة حاضر</title>')
assert i >= 0
s = s[i:]
if s.rstrip().endswith('</body></html>'):
    s = s.rstrip()[:-len('</body></html>')].rstrip() + '\n'


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, old[:80])
    s = s.replace(old, new)


# وضع المدرب لحساب المسؤول: يُخفي صلاحيات الإدارة في الواجهة (كما في الويب)
rep("const isAdmin = () => !!(A.me && A.me.role === 'admin');", "const isAdmin = () => !!(A.me && A.me.role === 'admin' && !A.asTrainer);")
rep("if (!A.me || A.me.role === 'admin' || A.me.role === 'viewer'", "if (!A.me || (A.me.role === 'admin' && !A.asTrainer) || A.me.role === 'viewer'")

rep('</style>\n<div id="gate"', '\n' + web('shared.css') + '\n' + web('grades.css') + '\n' + web('theme-v2.css') + '</style>\n<div id="gate"')
post = web('shared.js') + '\n' + web('portal.js') + '\n' + web('timeline.js') + '\n' + web('grades-web.js') + '\n' + web('grades-xl.js') + '\n' + web('theme-v2.js')
assert '</script' not in post
rep('\nboot();\n', '\n' + post + '\nboot();\n')

out = R / 'dist/artifact'
out.mkdir(parents=True, exist_ok=True)
(out / 'index.html').write_text(s, encoding='utf8')
v = out / 'vendor'
v.mkdir(exist_ok=True)
for f in (R / 'docs/vendor').iterdir():
    shutil.copy2(f, v / f.name)

# فحص صياغة كل السكربتات
import re
bad = 0
for k, m in enumerate(re.finditer(r'<script(?![^>]*type="text/plain")[^>]*>(.*?)</script>', s, re.S)):
    code = m.group(1)
    if not code.strip():
        continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf8') as t:
        t.write(code)
    r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True)
    if r.returncode:
        bad += 1
        print('syntax error in script', k, r.stderr[:400])
print('artifact:', out / 'index.html', f'{len(s.encode()):,} bytes', 'syntax: ' + ('ok' if not bad else 'FAILED'))
sys.exit(1 if bad else 0)
