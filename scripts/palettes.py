#!/usr/bin/env python3
"""Three colours from each project's cover, for the tab icon.
Writes src/palettes.json: { slug: ["#rrggbb", "#rrggbb", "#rrggbb"], ... }.
Re-run after changing a cover image."""
import json, glob, os, colorsys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'src/pages/*.json'))):
    p = json.load(open(f))
    if not p.get('images') or p['slug'] in ('About', 'Front-Page'): continue
    im = p['images'][0]; src = im.get('poster') or im.get('thumb') or im['src']
    img = Image.open(os.path.join(ROOT, 'src' + src)).convert('RGB').resize((64, 64))
    q = img.quantize(colors=8, method=Image.Quantize.MEDIANCUT).convert('RGB')
    cols = sorted(q.getcolors(64 * 64), reverse=True)        # (count, (r,g,b))
    def score(c):
        n, (r, g, b) = c; h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        return n * (0.35 + s) * (0.3 + min(l, 1 - l) * 2)     # common, saturated, not black or white
    cols = sorted(cols, key=score, reverse=True)
    bright = [c for c in cols if max(c[1]) > 40]; cols = bright + [c for c in cols if c not in bright]
    picked = []
    for n, rgb in cols:
        if all(sum(abs(a - b) for a, b in zip(rgb, q2)) > 60 for q2 in picked): picked.append(rgb)
        if len(picked) == 3: break
    while len(picked) < 3: picked.append(picked[-1])
    out[p['slug']] = ['#%02x%02x%02x' % c for c in picked]
json.dump(out, open(os.path.join(ROOT, 'src/palettes.json'), 'w'), indent=1)
print(len(out), 'palettes')
