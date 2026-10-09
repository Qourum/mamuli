#!/usr/bin/env python3
"""Builds მამული from src/.

  python3 tools/build.py            the website: index.html at the repository root (for GitHub Pages), next to art/ and rt.js,
                                    and sw.js, the offline helper that also makes the game installable
  python3 tools/build.py --preview DIR
                                    a preview page for Claude's artifact viewer in DIR: the page without its outer
                                    html/head/body tags, plus the pictures; online rooms are switched off there
                                    (the viewer allows no connections to other servers)

The pictures in art/ come from მეტეხი (github.com/qourum/metekhi); missing ones are copied from a checkout of it
(METEKHI=/path/to/metekhi, default ../qourum/metekhi), and so is rt.js, the bundled Supabase Realtime client.
"""
import hashlib, json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
METEKHI = os.environ.get('METEKHI', os.path.join(os.path.dirname(ROOT), 'qourum', 'metekhi'))
JS = ['data.js', 'engine.js', 'net.js', 'models.js', 'board3d.js', 'dice3d.js', 'ui.js', 'app.js']
THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'
HEROES = ['david', 'tamar', 'gorgasali', 'erekle', 'kakutsa', 'tariel', 'avtandil', 'gurdjieff', 'abrag', 'amirani', 'mikha', 'prometheus']
ART = ([f'por_h_{h}' for h in HEROES] + [f'h_{h}' for h in HEROES if h != 'david'] + ['h_davidride'] +
       ['t_archer_2', 's_fort', 's_camp', 't_palisade', 'ui_page', 'ui_chest_wood', 'ui_chest_wood_o', 'ui_coin', 'ui_coinbag',
        'ui_book', 'ui_feather', 'g_svan', 'g_elbrus', 'g_pass', 'g_stone', 'g_tbilisi'])
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;600;700;800'
         '&family=Noto+Serif+Georgian:wght@700;900&family=Lilita+One&display=swap">')
# the website asks for the fonts with CORS, so that the offline helper can keep them (the preview does not need to)
SITE_FONTS = FONTS.replace('<link rel="stylesheet" href=', '<link rel="stylesheet" crossorigin href=')
DESC = 'ქართული სამაგიდო თამაში მეგობრებთან ონლაინ: იყიდე ციხე-ქალაქები, ააშენე კოშკები, ივაჭრე და გააკოტრე მეტოქეები.'
SITE_HEAD = f'''<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no">
<title>მამული</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#0d1016">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="მამული">
<meta property="og:type" content="website">
<meta property="og:url" content="https://qourum.github.io/mamuli/">
<meta property="og:title" content="მამული">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="https://qourum.github.io/mamuli/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
{SITE_FONTS}
<style>:root{{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}}</style>
'''


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def sync_art(dest):
    os.makedirs(dest, exist_ok=True)
    for n in ART:
        d = os.path.join(dest, n + '.webp')
        if not os.path.exists(d):
            s = os.path.join(METEKHI, 'art', n + '.webp')
            if not os.path.exists(s):
                sys.exit(f'missing picture {n}.webp (no copy in {METEKHI}/art)')
            shutil.copyfile(s, d)


def page(site):
    css, body = read('style.css'), read('index.html').replace('<!--HEAD-->', '')
    code = '\n'.join(read(n) for n in JS)
    build = hashlib.sha1((css + body + code).encode()).hexdigest()[:10]
    js = f'const BUILD = "{build}";\nconst SITE = {"true" if site else "false"};\n' + code
    if site:
        return build, f'{SITE_HEAD}<style>\n{css}</style>\n</head>\n<body>\n{body}<script src="vendor/three.min.js"></script>\n<script>\n{js}</script>\n</body>\n</html>\n'
    return build, f'<title>მამული</title>\n{FONTS}\n<style>\n{css}</style>\n{body}<script src="{THREE_CDN}"></script>\n<script>\n{js}</script>\n'


def main():
    art = os.path.join(ROOT, 'art')
    sync_art(art)
    if not os.path.exists(os.path.join(ROOT, 'rt.js')):
        shutil.copyfile(os.path.join(METEKHI, 'rt.js'), os.path.join(ROOT, 'rt.js'))
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(os.path.join(out, 'art'), exist_ok=True)
        for n in ART:
            shutil.copyfile(os.path.join(art, n + '.webp'), os.path.join(out, 'art', n + '.webp'))
        build, html = page(False)
        with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'preview {build} -> {out}')
        return
    build, html = page(True)
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    # the offline helper: a new version with every new page, so the old page's copy is replaced
    sw = read('sw.js').replace("'__VERSION__'", json.dumps(build)).replace('__ARTS__', json.dumps([n + '.webp' for n in ART]))
    with open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8') as f:
        f.write(sw)
    print(f'site {build}: index.html {len(html) // 1024} KB, sw.js, {len(ART)} pictures')


if __name__ == '__main__':
    main()
