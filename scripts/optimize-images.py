#!/usr/bin/env python3
"""
Optimise images for the web.

  src/img-original/   the untouched files from Cargo (kept locally, git-ignored)
  src/img/            what the site serves, generated from the originals:
      stills  -> <name>.webp   (long edge <= 2400px, quality 82)
                 <name>-s.webp (long edge <= 1200px, for hover previews / the field)
      gifs    -> <name>.webm + <name>.mp4 (looping, silent) + <name>-poster.jpg + <name>-s.webp
      the slit-scan texture and social image are copied as they are

Then rewrites the image lists in src/pages/*.json to point at the new files.
Run again any time: it skips outputs that are already newer than their source.

  python3 scripts/optimize-images.py
"""
import json, os, subprocess, sys, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, 'src', 'img-original')
OUT = os.path.join(ROOT, 'src', 'img')
PAGES = os.path.join(ROOT, 'src', 'pages')
MAX_W, THUMB_W, Q = 2400, 1200, 82
KEEP_AS_IS = {'4a927375-webgl-bg.jpg', 'social.png'}

os.makedirs(OUT, exist_ok=True)

def newer(dst, src):
    return os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)

def save_webp(im, dst, max_w):
    im = im.convert('RGB')
    if max(im.size) > max_w:
        im = im.copy(); im.thumbnail((max_w, max_w), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=Q, method=6)
    return im.size

mapping = {}   # original filename -> {src, thumb, [mp4, poster], width, height}

# a page can ask for its poster from a particular second of a gif ("poster_time")
poster_at = {}
for f in os.listdir(PAGES):
    try:
        for im in json.load(open(os.path.join(PAGES, f))).get('images', []):
            if im.get('poster_time') is not None: poster_at[os.path.basename(im.get('original') or im['src']).rsplit('.', 1)[0]] = float(im['poster_time'])
    except Exception: pass

for f in sorted(os.listdir(ORIG)):
    src = os.path.join(ORIG, f)
    base, ext = os.path.splitext(f)
    ext = ext.lower()
    if f in KEEP_AS_IS:
        dst = os.path.join(OUT, f)
        if not newer(dst, src): shutil.copy2(src, dst)
        continue
    if ext in ('.jpg', '.jpeg', '.png'):
        if base.endswith('-poster'):   # regenerated from the gif below
            continue
        im = Image.open(src)
        w, h = im.size
        main = os.path.join(OUT, base + '.webp'); thumb = os.path.join(OUT, base + '-s.webp')
        if not newer(main, src): w, h = save_webp(im, main, MAX_W)
        else: w, h = Image.open(main).size
        if not newer(thumb, src): save_webp(im, thumb, THUMB_W)
        mapping[f] = {'src': '/img/' + base + '.webp', 'thumb': '/img/' + base + '-s.webp', 'width': w, 'height': h}
    elif ext == '.gif':
        im = Image.open(src); w, h = im.size
        # even dimensions for h264
        ew, eh = w - w % 2, h - h % 2
        webm = os.path.join(OUT, base + '.webm'); mp4 = os.path.join(OUT, base + '.mp4')
        poster = os.path.join(OUT, base + '-poster.jpg'); thumb = os.path.join(OUT, base + '-s.webp')
        vf = f'scale={ew}:{eh}:flags=lanczos'
        if not newer(webm, src):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-an', webm], check=True)
        if not newer(mp4, src):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], check=True)
        if not newer(poster, src) or base in poster_at:
            if base in poster_at:
                # pull the frame from the mp4 at that time
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(poster_at[base]), '-i', mp4, '-frames:v', '1', '-q:v', '2', poster], check=True)
                fr = Image.open(poster).convert('RGB')
            else:
                im.seek(min(5, getattr(im, 'n_frames', 1) - 1)); fr = im.convert('RGB')
                fr.save(poster, 'JPEG', quality=84, optimize=True, progressive=True)
            save_webp(fr, thumb, THUMB_W)
        mapping[f] = {'src': '/img/' + base + '.webm', 'mp4': '/img/' + base + '.mp4', 'poster': '/img/' + base + '-poster.jpg', 'thumb': '/img/' + base + '-s.webp', 'width': ew, 'height': eh}
    else:
        print('skipped', f)

# rewrite page JSONs
changed = 0
for f in sorted(os.listdir(PAGES)):
    p = os.path.join(PAGES, f)
    page = json.load(open(p))
    dirty = False
    for im in page.get('images', []):
        name = os.path.basename(im['src'])
        if name in mapping:
            m = mapping[name]
            im['original'] = '/img-original/' + name
            im.update(m); dirty = True
    bd = page.get('backdrop') or {}
    if bd.get('image') and os.path.basename(bd['image']['src']) in mapping:
        bd['image'].update(mapping[os.path.basename(bd['image']['src'])]); dirty = True
    if dirty:
        json.dump(page, open(p, 'w'), indent=1, ensure_ascii=False); changed += 1

total = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
print(f'{len(mapping)} images optimised, {changed} pages updated, src/img = {total // 1024 // 1024} MB')
