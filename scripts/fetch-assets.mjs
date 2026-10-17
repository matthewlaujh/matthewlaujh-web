#!/usr/bin/env node
/*
 * Downloads every image the site uses from Cargo's CDN into src/img/.
 *
 *   node scripts/fetch-assets.mjs          # fetch what's missing
 *   node scripts/fetch-assets.mjs --force  # re-download everything
 *
 * Needs Node 18+ (built-in fetch). Safe to re-run; already-downloaded files
 * are skipped. Then run `node build.js`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'img');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'assets.json'), 'utf8'));
const FORCE = process.argv.includes('--force');

const HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
	'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
	'Referer': 'https://matthewlaujh.com/',
	'Origin': 'https://matthewlaujh.com'
};

fs.mkdirSync(OUT, { recursive: true });

const entries = Object.entries(MAP);
const todo = entries.filter(([, name]) => FORCE || !fs.existsSync(path.join(OUT, name)));
console.log(`${entries.length} assets, ${todo.length} to fetch -> ${path.relative(process.cwd(), OUT)}/`);

const failed = [];
let i = 0;
for (const [url, name] of todo) {
	i++;
	const dst = path.join(OUT, name);
	let ok = false;
	for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
		try {
			const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.length < 100) throw new Error(`suspiciously small (${buf.length} bytes)`);
			fs.writeFileSync(dst, buf);
			console.log(`[${i}/${todo.length}] ${name} (${Math.round(buf.length / 1024)} KB)`);
			ok = true;
		} catch (e) {
			if (attempt === 3) {
				console.error(`[${i}/${todo.length}] FAILED ${name}: ${e.message}`);
				failed.push([url, name]);
			} else {
				await new Promise(r => setTimeout(r, 1000 * attempt));
			}
		}
	}
}

if (failed.length) {
	console.error(`\n${failed.length} failed. Re-run to retry, or fetch these by hand:`);
	for (const [url, name] of failed) console.error(`  ${name}\n    ${url}`);
	process.exit(1);
}
console.log('\nAll assets present. Now run: node build.js');
