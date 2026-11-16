#!/usr/bin/env python3
"""يبني نسخة الويب المنشورة على GitHub Pages (docs/) من index.html.

index.html هو المنصة نفسها كما تعمل داخل Claude. هذا البرنامج يضيف إليها:
  - طبقة الاتصال بالخادم (src/web/shim.js) قبل شيفرة المنصة
  - ربط شاشة الدخول والجلسة (src/web/post.js) وبوابة المتدرب (src/web/portal.js) قبل الإقلاع
  - أنماط الويب (src/web/web.css)
  - رابط QR يفتح بوابة المتدرب مباشرة بدل نموذج Forms
ولا يغيّر أي وظيفة أخرى في المنصة.

الاستخدام: python3 tools/build_web.py
"""
import hashlib, json, pathlib, subprocess, sys, datetime

R = pathlib.Path(__file__).resolve().parent.parent
s = (R / 'index.html').read_text(encoding='utf8')
web = lambda n: (R / 'src/web' / n).read_text(encoding='utf8')
cfg = json.loads((R / 'supabase/config.json').read_text(encoding='utf8'))


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, old[:80])
    s = s.replace(old, new)


# 1) الأنماط
rep('</style>\n<div id="gate"', '\n' + web('web.css') + '\n' + web('shared.css') + '\n' + web('grades.css') + '\n' + web('theme-v2.css') + '</style>\n<div id="gate"')

# 2) رابط QR وتعليماته: المتدرب يدخل برقمه التدريبي فيُسجَّل حضوره مباشرة
rep('const qrUrl = (code) => { const f = qrCfg().form;',
    'const qrUrl = (code) => { if (window.HAADER_WEB) return window.HAADER_WEB.qrLink(code); const f = qrCfg().form;')
rep('امسح الرمز بكاميرا الجوال وسجّل بحسابك في المؤسسة',
    'امسح الرمز بكاميرا الجوال وسجّل دخولك برقمك التدريبي')
rep('امسح الرمز بكاميرا الجوال، وسجّل بحسابك في المؤسسة، واكتب رقمك التدريبي ثم اضغط «إرسال».',
    'امسح الرمز بكاميرا الجوال، وسجّل دخولك في منصة حاضر برقمك التدريبي، فيُسجَّل حضورك مباشرة.')
rep('يمسح المتدرب الرمز بكاميرا الجوال، ويسجّل بحسابه في المؤسسة، ثم يُعتمد حضوره هنا فيظهر «حاضر» في الكشف.',
    'يمسح المتدرب الرمز بكاميرا الجوال ويدخل برقمه التدريبي، فيُسجَّل حضوره في الكشف مباشرة («ح» أو «م» بدقائق التأخير)، ويظهر هنا خلال ثوانٍ.')

# 2ب) وضع «الدخول كمدرب» لحساب المسؤول: يُخفي صلاحيات الإدارة في الواجهة ويقصر العرض على شعبه
rep("const isAdmin = () => !!(A.me && A.me.role === 'admin');", "const isAdmin = () => !!(A.me && A.me.role === 'admin' && !A.asTrainer);")
rep("if (!A.me || A.me.role === 'admin' || A.me.role === 'viewer'", "if (!A.me || (A.me.role === 'admin' && !A.asTrainer) || A.me.role === 'viewer'")

# 3) ربط الدخول وبوابة المتدرب: قبل إقلاع المنصة
post = web('post.js') + '\n' + web('shared.js') + '\n' + web('portal.js') + '\n' + web('timeline.js') + '\n' + web('grades-web.js') + '\n' + web('grades-xl.js') + '\n' + web('theme-v2.js')
assert '</script' not in post
rep('\nboot();\n', '\n' + post + '\nboot();\n')

# 4) طبقة الاتصال: قبل كل شيفرة المنصة
shim = web('shim.js')
assert '</script' not in shim
build = hashlib.sha256((s + shim).encode('utf8')).hexdigest()[:12]
head = (
    f'<script>window.HAADER_CFG={json.dumps({"url": cfg["url"], "key": cfg["publishable_key"]})};window.HAADER_BUILD="{build}";</script>\n'
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" crossorigin="anonymous"></script>\n'
    f'<script>\n{shim}\n</script>\n'
)
rep('<script type="text/plain" id="bridge-src">', head + '<script type="text/plain" id="bridge-src">')
rep('<title>منصة حاضر</title>', '<title>منصة حاضر</title>\n<meta name="robots" content="noindex,nofollow">\n<meta name="theme-color" content="#003366">\n<meta name="referrer" content="strict-origin-when-cross-origin">')

out = R / 'docs'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(s, encoding='utf8')
(out / 'version.json').write_text(json.dumps({'build': build, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}), encoding='utf8')
(out / '.nojekyll').write_text('', encoding='utf8')
print('docs/index.html', len(s.encode('utf8')), 'bytes; build', build)

# فحص نحوي لكل سكربت مضمَّن
import re, tempfile
bad = 0
for i, m in enumerate(re.finditer(r'<script>(.*?)</script>', s, re.S)):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf8') as f:
        f.write(m.group(1))
    r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
    if r.returncode:
        bad += 1
        print('script', i, 'syntax error:', r.stderr[:600])
print('syntax:', 'ok' if not bad else f'{bad} errors')
sys.exit(1 if bad else 0)
