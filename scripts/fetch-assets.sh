#!/usr/bin/env bash
# Downloads every image the site uses from Cargo's CDN into src/img/.
# Usage: ./scripts/fetch-assets.sh   (then: node build.js)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p src/img
python3 - <<'PY'
import json, os, sys, urllib.request
m = json.load(open('scripts/assets.json'))
todo = [(u, n) for u, n in m.items() if not os.path.exists(os.path.join('src/img', n))]
print(f"{len(m)} assets, {len(todo)} to fetch")
for i, (u, n) in enumerate(todo, 1):
    dst = os.path.join('src/img', n)
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=120) as r, open(dst + '.part', 'wb') as f:
            while True:
                chunk = r.read(1 << 16)
                if not chunk: break
                f.write(chunk)
        os.replace(dst + '.part', dst)
        print(f"[{i}/{len(todo)}] {n} ({os.path.getsize(dst)//1024} KB)")
    except Exception as e:
        print(f"[{i}/{len(todo)}] FAILED {n}: {e}", file=sys.stderr)
PY
