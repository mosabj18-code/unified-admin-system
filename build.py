# -*- coding: utf-8 -*-
"""يبني مخرجات النظام من المصدر في unified-admin/ :
   dist/            نسخة مصغّرة كاملة (للرفع على Netlify)
   ..._vX.html      ملف واحد مصغّر مع المكتبتين بداخله
   ..._vX.zip       حزمة dist
   المصدر يبقى كما هو — التصغير على المخرَج فقط."""
import io, os, re, sys, shutil, zipfile, subprocess, tempfile

SRC = 'unified-admin'
OUT = os.environ.get('OUT_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'release')


import json
def assemble():
    """يجمّع src/ في unified-admin/index.html (نسخة تطوير مقروءة)."""
    mf = json.loads(io.open('src/manifest.json', encoding='utf-8').read())
    tpl = io.open('src/index.template.html', encoding='utf-8').read()
    css = '\n'.join(io.open('src/styles/' + f, encoding='utf-8').read().rstrip('\n') for f in mf['styles'])
    titles = {'wared':'سجل الوارد والصادر','payroll':'دفتر الرواتب','equipment':'مخزون المعدات','fuel':'توزيع الوقود',
              'inventory':'مخزون الطعام','cleaning':'توزيع المنظفات','custody':'إدارة العهد'}
    parts = []
    for f in mf['modules']:
        key = f[:-3]
        parts.append('<!-- وحدة: %s -->\n<script>\n%s\n</script>\n' %
                     (titles.get(key, key), io.open('src/modules/' + f, encoding='utf-8').read().rstrip('\n')))
    parts.append('<script>\n%s\n</script>' % io.open('src/shell.js', encoding='utf-8').read().rstrip('\n'))
    out = tpl.replace('/*#STYLES#*/', css)
    out = out.replace('/*#BOOT#*/', io.open('src/boot.js', encoding='utf-8').read().rstrip('\n'))
    out = out.replace('<!--#SCRIPTS#-->', '\n'.join(parts))
    io.open(os.path.join(SRC, 'index.html'), 'w', encoding='utf-8').write(out)
    return out

def minify_css(css):
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)
    css = re.sub(r'\s*\n\s*', '\n', css)
    css = re.sub(r'\n+', '\n', css)
    css = re.sub(r'\s*([{};:,>])\s*', r'\1', css)
    css = css.replace(';}', '}')
    return css.strip()

def strip_comment_lines(js):
    """يحذف أسطر التعليقات الكاملة فقط — لا يلمس ما بداخل النصوص."""
    out, in_block = [], False
    for line in js.split('\n'):
        t = line.strip()
        if in_block:
            if '*/' in t:
                in_block = False
                tail = t.split('*/', 1)[1].strip()
                if tail: out.append(tail)
            continue
        if t.startswith('/*'):
            if '*/' in t[2:]:
                tail = t.split('*/', 1)[1].strip()
                if tail: out.append(tail)
            else:
                in_block = True
            continue
        if t.startswith('//') and 'http' not in t[:10]:
            continue
        out.append(line)
    return '\n'.join(out)

def dedent_and_squeeze(js):
    """يزيل المسافات البادئة والأسطر الفارغة. آمن: JS لا يعتمد على المسافة البادئة،
       والنصوص القالبية تُنتج HTML/CSS لا يتأثر بها."""
    lines = [re.sub(r'^[ \t]+', '', l) for l in js.split('\n')]
    return '\n'.join(l for l in lines if l.strip() != '')

TERSER = shutil.which('terser')
def terser(js):
    """تصغير JS مع الإبقاء على الأسماء العامة (onclick في HTML يعتمد عليها)."""
    if not TERSER: return dedent_and_squeeze(strip_comment_lines(js))
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(js); path = f.name
    try:
        r = subprocess.run([TERSER, path, '--compress', 'passes=2', '--mangle', '--format', 'ascii_only=false'],
                           capture_output=True, text=True)
        if r.returncode != 0 or not r.stdout.strip():
            print('  ! terser فشل، رجعنا للتصغير البسيط:', (r.stderr or '')[:120])
            return dedent_and_squeeze(strip_comment_lines(js))
        return r.stdout
    finally:
        os.unlink(path)

def minify_html(html):
    # CSS داخل <style>
    def css_rep(m): return '<style>' + minify_css(m.group(1)) + '</style>'
    html = re.sub(r'<style>([\s\S]*?)</style>', css_rep, html, count=1)
    # JS داخل كل <script> بلا src
    def js_rep(m):
        js = m.group(1)
        return '<script>' + terser(js) + '</script>'
    html = re.sub(r'<script>([\s\S]*?)</script>', js_rep, html)
    # تعليقات HTML (عدا الشرطية)
    html = re.sub(r'<!--(?!\[if)[\s\S]*?-->', '', html)
    return html

def build(version):
    assemble()
    dist = 'dist'
    if os.path.exists(dist): shutil.rmtree(dist)
    shutil.copytree(SRC, dist)

    idx = io.open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
    assert "const APP_VERSION = '%s';" % version in idx, 'الإصدار في index.html لا يطابق %s' % version
    sw = io.open(os.path.join(SRC, 'sw.js'), encoding='utf-8').read()
    assert "const APP_VERSION = '%s';" % version in sw, 'الإصدار في sw.js لا يطابق %s' % version

    small = minify_html(idx)
    io.open(os.path.join(dist, 'index.html'), 'w', encoding='utf-8').write(small)
    for lib in os.listdir(os.path.join(SRC, 'lib')):
        p = os.path.join(SRC, 'lib', lib)
        js = io.open(p, encoding='utf-8').read()
        io.open(os.path.join(dist, 'lib', lib), 'w', encoding='utf-8').write(terser(js))
    io.open(os.path.join(dist, 'sw.js'), 'w', encoding='utf-8').write(terser(sw))

    # ملف واحد: دمج المكتبتين
    single = small
    for lib in ['lib/xlsx.mini.js', 'lib/chart.mini.js']:
        code = io.open(os.path.join(dist, lib), encoding='utf-8').read().replace('</script', '<\\/script')
        tag = '<script src="%s"></script>' % lib
        assert tag in single, lib
        single = single.replace(tag, '<script>%s</script>' % code)
    assert 'script src="lib/' not in single

    os.makedirs(OUT, exist_ok=True)
    name = 'النظام_الإداري_الموحد_v%s' % version
    io.open(os.path.join(OUT, name + '.html'), 'w', encoding='utf-8').write(single)
    zp = os.path.join(OUT, name + '.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(dist):
            for f in files:
                p = os.path.join(root, f)
                z.write(p, os.path.join('unified-admin', os.path.relpath(p, dist)))

    src_single = len(idx.encode()) + sum(os.path.getsize(os.path.join(SRC, 'lib', l)) for l in os.listdir(os.path.join(SRC, 'lib')))
    print('index:  %d ← %d ك.ب' % (len(single.encode()) // 1024, src_single // 1024))
    print('ملف واحد: %d ك.ب' % (os.path.getsize(os.path.join(OUT, name + '.html')) // 1024))
    print('الحزمة:   %d ك.ب' % (os.path.getsize(zp) // 1024))

if __name__ == '__main__':
    build(sys.argv[1])
