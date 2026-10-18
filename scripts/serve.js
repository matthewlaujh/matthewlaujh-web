#!/usr/bin/env node
/* A tiny dev server that behaves like Cloudflare Pages: clean URLs resolve to
   their .html files and / is index.html.   node scripts/serve.js [port] */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', 'public');
const PORT = +process.argv[2] || 8000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.otf': 'font/otf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
http.createServer((req, res) => {
	let p = decodeURIComponent(req.url.split('?')[0]);
	if (p.endsWith('/')) p += 'index.html';
	let file = path.join(ROOT, p);
	if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
	if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
		if (fs.existsSync(file + '.html')) file += '.html';
		else { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found: ' + p); }
	}
	res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
	fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`matthewlaujh.com -> http://localhost:${PORT}`));
