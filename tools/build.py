#!/usr/bin/env python3
"""Builds შენი ჯერი (the game once called მამული; its address and storage keep that name) from src/.

  python3 tools/build.py            the website: index.html at the repository root (for GitHub Pages), next to art/ and rt.js,
                                    and sw.js, the offline helper that also makes the game installable
  python3 tools/build.py --preview DIR
                                    a preview page for Claude's artifact viewer in DIR: the page without its outer
                                    html/head/body tags, plus the pictures; online rooms are switched off there
                                    (the viewer allows no connections to other servers)

The pictures in art/ come from მეტეხი (github.com/qourum/metekhi), the archipelago's from its Higgsfield references; missing
ones of მეტეხი are copied from a checkout of it
(METEKHI=/path/to/metekhi, default ../qourum/metekhi), and so is rt.js, the bundled Supabase Realtime client.
"""
import base64, hashlib, json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
METEKHI = os.environ.get('METEKHI', os.path.join(os.path.dirname(ROOT), 'qourum', 'metekhi'))
JS = ['diag.js', 'data.js', 'themes.js', 'engine.js', 'trade-insights.js', 'net.js', 'voice.js', 'terrain.js', 'models.js', 'sea.js', 'glb.js', 'marine.js', 'lagoon.js', 'reef.js', 'weather.js', 'place-models.js', 'map-props.js', 'place-fx.js', 'render-pacer.js', 'board3d.js', 'dice3d.js', 'pictures.js', 'card3d.js', 'ui.js', 'app.js', 'perf.js']
THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'
HEROES = ['david', 'tamar', 'gorgasali', 'erekle', 'kakutsa', 'tariel', 'avtandil', 'gurdjieff', 'abrag', 'amirani', 'mikha', 'prometheus']
PIRATES = ['blackbeard', 'bonny', 'read', 'chingshih', 'omalley', 'morgan', 'kidd', 'roberts', 'barbarossa', 'bellamy', 'labuse', 'stortebeker']
# the archipelago's pictures: its pirates' portraits and its places, made from the Higgsfield references (they live in art/)
SEA_ART = ([f'por_p_{p}' for p in PIRATES] + ['bg_sea'] + [f'sc_{n}' for n in ['north', 'gotland', 'med', 'atlantic', 'antilles', 'caribbean', 'indian', 'pacific', 'oak', 'cocos',
           'qar', 'whydah', 'galley', 'fortune', 'lighthouse', 'shipyard', 'customs', 'whirlpool', 'port', 'isle', 'tavern', 'kraken', 'chest', 'bottle']])
# the archipelago's 3D models, made from the Higgsfield pictures with tools/glb_prep.mjs (art/m_*.glb; sea.js says where)
MODELS = ['m_heligoland_animated', 'm_cocos_animated', 'm_volcano_animated', 'm_gotland_animated', 'm_customs_animated', 'm_gramvousa_animated', 'm_lighthouse_animated', 'm_shipyard_animated', 'm_cheungchau_animated', 'm_oak_animated',
          'm_port_animated', 'm_castaway_animated', 'm_tavern_animated', 'm_kraken_animated', 'm_qar_animated', 'm_whydah_animated', 'm_galley_animated', 'm_fortune_animated', 'm_shark', 'm_orca', 'm_bluewhale', 'm_dolphin']
ART = ([f'por_h_{h}' for h in HEROES] + [f'h_{h}' for h in HEROES if h != 'david'] + ['h_davidride'] + SEA_ART +
       ['t_archer_2', 's_fort', 's_camp', 't_palisade', 'ui_page', 'ui_chest_wood', 'ui_chest_wood_o', 'ui_coin', 'ui_coinbag',
        'ui_book', 'ui_feather', 'g_svan', 'g_elbrus', 'g_pass', 'g_stone', 'g_tbilisi'])
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;600;700;800'
         '&family=Noto+Serif+Georgian:wght@700;900&family=Lilita+One&display=swap">')
# the website asks for the fonts with CORS, so that the offline helper can keep them (the preview does not need to)
SITE_FONTS = FONTS.replace('<link rel="stylesheet" href=', '<link rel="stylesheet" crossorigin href=')
DESC = 'ქართული სამაგიდო თამაში მეგობრებთან ონლაინ, ორ სამყაროში: საქართველოს ციხე-ქალაქები ან მეკობრეების განძის კუნძულები. იყიდე, ააშენე, ივაჭრე და გააკოტრე მეტოქეები.'
SITE_HEAD = f'''<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no">
<title>შენი ჯერი</title>
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#0d1016">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="შენი ჯერი">
<meta property="og:type" content="website">
<meta property="og:url" content="https://qourum.github.io/mamuli/">
<meta property="og:title" content="შენი ჯერი">
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


CARD_PICTURES = sorted(n for n in os.listdir(os.path.join(ROOT, 'art')) if n.startswith('card_') and n.endswith('.jpg'))
MOBILE_MODELS = ['mobile/' + m + '.glb' for m in MODELS if m.endswith('_animated')]
FILES = [n + '.webp' for n in ART] + CARD_PICTURES + [m + '.glb' for m in MODELS] + MOBILE_MODELS


def sync_art(dest):
    os.makedirs(dest, exist_ok=True)
    for m in MODELS:
        if not os.path.exists(os.path.join(dest, m + '.glb')):
            sys.exit(f'missing model {m}.glb')
    for m in MOBILE_MODELS:
        if not os.path.exists(os.path.join(dest, m)):
            sys.exit(f'missing mobile model {m}; run tools/mobile-lod.mjs first')
    for n in ART:
        d = os.path.join(dest, n + '.webp')
        if not os.path.exists(d):
            s = os.path.join(METEKHI, 'art', n + '.webp')
            if not os.path.exists(s):
                sys.exit(f'missing picture {n}.webp (no copy in {METEKHI}/art)')
            shutil.copyfile(s, d)


def asset_revisions():
    revisions = {}
    for name in ['art/' + f for f in FILES] + ['vendor/three.min.js', 'vendor/GLTFLoader.min.js']:
        with open(os.path.join(ROOT, name), 'rb') as source:
            revisions[name] = hashlib.sha256(source.read()).hexdigest()
    return revisions


def page(site):
    css, body = read('style.css') + '\n' + read('portfolio.css'), read('index.html').replace('<!--HEAD-->', '')
    code = '\n'.join(read(n) for n in JS)
    # Worker-only fixes and changed asset bytes both identify a new release.
    build = hashlib.sha1((css + body + code + read('sw.js') + json.dumps(asset_revisions(), sort_keys=True)).encode()).hexdigest()[:10]
    js = f'const BUILD = "{build}";\nconst SITE = {"true" if site else "false"};\n' + code
    if site:
        return build, f'{SITE_HEAD}<style>\n{css}</style>\n</head>\n<body>\n{body}<script src="vendor/three.min.js"></script>\n<script src="vendor/GLTFLoader.min.js"></script>\n<script>\n{js}</script>\n</body>\n</html>\n'
    return build, f'<title>შენი ჯერი</title>\n{FONTS}\n<style>\n{css}</style>\n{body}<script src="{THREE_CDN}"></script>\n<script src="vendor/GLTFLoader.min.js"></script>\n<script>\n{js}</script>\n'


def main():
    art = os.path.join(ROOT, 'art')
    sync_art(art)
    if not os.path.exists(os.path.join(ROOT, 'rt.js')):
        shutil.copyfile(os.path.join(METEKHI, 'rt.js'), os.path.join(ROOT, 'rt.js'))
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(os.path.join(out, 'art'), exist_ok=True)
        os.makedirs(os.path.join(out, 'vendor'), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, 'vendor', 'GLTFLoader.min.js'), os.path.join(out, 'vendor', 'GLTFLoader.min.js'))
        for f in FILES:
            os.makedirs(os.path.dirname(os.path.join(out, 'art', f)), exist_ok=True)
            if f.endswith('.glb'):         # (Claude's viewer serves no .glb files: they go as text, base64, glb.js reads them so)
                with open(os.path.join(art, f), 'rb') as src, open(os.path.join(out, 'art', f + '.txt'), 'w') as dst:
                    dst.write(base64.b64encode(src.read()).decode())
            else:
                shutil.copyfile(os.path.join(art, f), os.path.join(out, 'art', f))
        build, html = page(False)
        with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'preview {build} -> {out}')
        return
    build, html = page(True)
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    # the offline helper: a new version with every new page, so the old page's copy is replaced
    revisions = asset_revisions()
    sw = read('sw.js').replace("'__VERSION__'", json.dumps(build)).replace('__ARTS__', json.dumps(FILES)).replace('__ASSET_REVISIONS__', json.dumps(revisions, sort_keys=True))
    with open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8') as f:
        f.write(sw)
    print(f'site {build}: index.html {len(html) // 1024} KB, sw.js, {len(ART) + len(CARD_PICTURES)} pictures, {len(MODELS)} models')


if __name__ == '__main__':
    main()
