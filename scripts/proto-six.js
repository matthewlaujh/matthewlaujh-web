#!/usr/bin/env node
/*
 * Six whole-site directions (home + one project page each), built on the real
 * content. Not part of the production build.
 *   node scripts/proto-six.js  -> preview/o1-home.html, o1-project.html … o6-*
 */
'use strict';
const fs = require('fs');
const path = require('path');
const convert = require('../src/lib/convert.js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'preview');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const pages = fs.readdirSync(path.join(SRC, 'pages')).map(f => read(path.join(SRC, 'pages', f)));
const bySlug = Object.fromEntries(pages.map(p => [p.slug, p]));
const nav = convert.navModel(read(path.join(SRC, 'pinned', 'nav.json')).content);
const home = bySlug['Front-Page'];
const introHTML = convert.blocks(convert.textColumn(home.content).slice(-1)[0].html)
	.replace(/<p><a[^>]*>Click here for more about me\.<\/a><\/p>/, '')
	.replace(/<hr>\s*$/, '');

/* ---------------------------------------------------------------- model */
const works = nav.groups.flatMap(g => g.items.filter(i => i.href && bySlug[i.href]).map(i => {
	const p = bySlug[i.href];
	const prose = convert.prose(p.content);
	const paras = prose.split(/\n(?=<)/);
	const firstP = paras.find(x => x.startsWith('<p>')) || '';
	const context = firstP.replace(/<\/?p>/g, '');
	const rest = prose.replace(firstP, '').replace(/^\s*<hr>\s*/, '').replace(/<hr>\s*$/, '');
	const title = p.title_no_html.replace(/\s*\(\d{4}(?:[–-]\d{4})?\)\s*$/, '').replace(/,\s*$/, '');
	const year = (p.title_no_html.match(/\((\d{4}(?:[–-]\d{4})?)\)/) || [])[1] || '';
	const images = p.images.map(im => ({ src: im.src.replace(/^\//, ''), w: im.width, h: im.height, gif: /\.gif$/i.test(im.src) }));
	return { slug: p.slug, title, year, category: g.label, context, body: rest, images, cover: images[0] };
}));
const FEATURE = 'Ambi-latent-Space-2025';
const feature = works.find(w => w.slug === FEATURE);

function fix(html, variant) {
	return html.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, href, post, inner) => {
		if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(href)) return bySlug[href] ? `<a href="${variant}-project.html">${inner}</a>` : inner;
		return `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;
	});
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ----------------------------------------------------------------- base */
const BASE_CSS = `
@font-face{font-family:"Austin News Deck";font-weight:300;font-style:normal;src:url(fonts/AustinNewsDeck-Light.otf) format("opentype")}
@font-face{font-family:"Austin News Deck";font-weight:300;font-style:italic;src:url(fonts/AustinNewsDeck-LightItalic.otf) format("opentype")}
@font-face{font-family:"Atlas Grotesk";font-weight:300;font-style:normal;src:url(fonts/AtlasGrotesk-Light.otf) format("opentype")}
@font-face{font-family:"Atlas Grotesk";font-weight:300;font-style:italic;src:url(fonts/AtlasGrotesk-LightItalic.otf) format("opentype")}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:none}
body{margin:0;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:inherit;text-decoration:none}
a:focus-visible{outline:1px solid currentColor;outline-offset:3px}
img{display:block;max-width:100%;height:auto}
p,h1,h2,h3,ul,dl,dd,figure{margin:0}
ul{padding:0;list-style:none}
.prose p+p,.prose ul+p,.prose p+ul{margin-top:.6em}
.prose hr{border:0;border-top:1px solid currentColor;opacity:.3;margin:1em 0;width:2em}
.prose ul{padding-left:1.1em;list-style:disc}
.prose i{font-style:italic}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

function shell(title, css, body, js) {
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}${css}</style></head><body>${body}${js ? `<script>${js}</script>` : ''}</body></html>`;
}

const out = {};

/* =====================================================================
   O1 — INDEX. Downtown studio. One typeface, one table, images on hover.
   ===================================================================== */
{
	const css = `
body{background:#fff;color:#111;font:300 13px/1.45 "Atlas Grotesk",Helvetica,Arial,sans-serif;padding:20px 24px 120px}
header{display:flex;justify-content:space-between;gap:24px;margin-bottom:64px}
header nav{display:flex;gap:24px}
.intro{max-width:52ch;margin-bottom:64px}
.intro p+p{margin-top:.6em}
table{width:62%;border-collapse:collapse}
th{text-align:left;font-weight:300;color:#888;padding:0 24px 10px 0;border-bottom:1px solid #111}
td{padding:7px 24px 7px 0;border-bottom:1px solid #ddd;vertical-align:top}
tr.w{cursor:pointer}
tr.w:hover td{color:#888}
tr.w:hover td.t{color:#111}
td.y{width:4em;white-space:nowrap}
td.c{width:9em}
td.x{color:#888;white-space:nowrap}
tr.dead td{color:#aaa}
.peek{position:fixed;right:24px;top:50%;transform:translateY(-50%);width:30vw;pointer-events:none;opacity:0;transition:opacity .18s}
.peek.on{opacity:1}
.peek img{width:100%;height:auto}
.peek figcaption{margin-top:6px;color:#888}
footer{position:fixed;left:0;right:0;bottom:0;padding:14px 24px;background:#fff;display:flex;justify-content:space-between;color:#888}
/* project */
.pj{display:grid;grid-template-columns:minmax(0,60fr) minmax(0,40fr);gap:24px 48px;align-items:start}
.pj .meta{position:sticky;top:20px}
.pj .meta dl{display:grid;grid-template-columns:7em 1fr;gap:4px 12px;border-top:1px solid #111;padding-top:10px;margin-bottom:28px}
.pj .meta dt{color:#888}
.pj .plates figure+figure{margin-top:24px}
.pj .plates figcaption{margin-top:6px;color:#888}
.ttl{font-size:13px;margin:0 0 28px}
.pn{display:flex;justify-content:space-between;margin-top:48px;color:#888}
.pn a:hover{color:#111}
@media(max-width:800px){.pj{grid-template-columns:1fr}.pj .meta{position:static}.peek{display:none}td.x,th.x{display:none}table{width:100%}body{padding-bottom:80px}}
`;
	const header = (page) => `<header><a href="o1-home.html">Matthew Lau</a><nav><a href="o1-home.html"${page === 'home' ? ' aria-current="page"' : ''}>Index</a><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></nav></header>`;
	const rows = works.map(w => `<tr class="w" data-img="${w.cover.src}" data-cap="${esc(w.title)}, ${w.year}" onclick="location.href='o1-project.html'"><td class="y">${w.year}</td><td class="t">${w.title}</td><td class="c">${w.category}</td><td class="x">${w.images.length} image${w.images.length === 1 ? '' : 's'}</td></tr>`).join('');
	const dead = nav.groups.flatMap(g => g.items.filter(i => !i.href || !bySlug[i.href]).map(i => `<tr class="dead"><td class="y">2021</td><td class="t">${i.text.replace(/\s*\(.*\)$/, '')}</td><td class="c">${g.label}</td><td class="x">In progress</td></tr>`)).join('');
	out['o1-home'] = shell('Matthew Lau — Index', css, `${header('home')}
<div class="intro prose">${introHTML}</div>
<table><thead><tr><th>Year</th><th>Work</th><th>Category</th><th class="x">Images</th></tr></thead><tbody>${rows}${dead}</tbody></table>
<figure class="peek" id="peek"><img alt=""><figcaption></figcaption></figure>
<footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`,
	`var pk=document.getElementById('peek'),im=pk.querySelector('img'),cap=pk.querySelector('figcaption');document.querySelectorAll('tr.w').forEach(function(r){r.addEventListener('mouseenter',function(){im.src=r.dataset.img;cap.textContent=r.dataset.cap;pk.classList.add('on')});r.addEventListener('mouseleave',function(){pk.classList.remove('on')})});`);
	const w = feature;
	out['o1-project'] = shell(w.title, css, `${header('project')}
<p class="ttl"><a href="o1-home.html">Index</a> / ${w.title}</p>
<div class="pj">
<div class="plates">${w.images.map((im, i) => `<figure><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}"><figcaption>${i + 1}/${w.images.length}</figcaption></figure>`).join('')}</div>
<aside class="meta"><h1 class="ttl">${w.title}</h1><dl><dt>Year</dt><dd>${w.year}</dd><dt>Category</dt><dd>${w.category}</dd><dt>Context</dt><dd>${fix(w.context, 'o1')}</dd></dl><div class="prose">${fix(w.body, 'o1')}</div><nav class="pn"><a href="o1-home.html">← Index</a><a href="o1-project.html">Next: Deconstructed Ambiance →</a></nav></aside>
</div>
<footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`);
}

/* =====================================================================
   O2 — WALL LABEL. Museum catalogue: plates with figure numbers, label column.
   ===================================================================== */
{
	const css = `
body{background:#e8e8e6;color:#1a1a1a;font:300 15px/1.5 "Austin News Deck",Georgia,serif;padding:28px 32px 96px}
.lab{font:300 11.5px/1.45 "Atlas Grotesk",Helvetica,Arial,sans-serif;letter-spacing:.01em}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:56px}
header h1{font-size:15px;font-weight:300}
.plates{display:grid;grid-template-columns:repeat(4,1fr);gap:40px 28px}
.plates figure a{display:block}
.plates img{width:100%;aspect-ratio:3/2;object-fit:cover;background:#dcdcda}
.plates figcaption{margin-top:9px}
.plates figcaption b{font-weight:300;display:block;color:#1a1a1a;font-family:"Austin News Deck",serif;font-size:14px}
.plates figcaption span{color:#666}
.plates figure:hover img{filter:contrast(1.05)}
.intro{max-width:46rem;margin-bottom:64px;font-size:19px;line-height:1.45}
.intro p+p{margin-top:.5em}
footer{margin-top:96px;display:flex;justify-content:space-between;color:#666}
/* project */
.cat{display:grid;grid-template-columns:19rem 1fr;gap:48px;align-items:start}
.label{position:sticky;top:28px;border-top:1px solid #1a1a1a;padding-top:12px}
.label h1{font-size:22px;font-weight:300;line-height:1.2;margin-bottom:2px}
.label .yr{color:#666;margin-bottom:18px}
.label dl{display:grid;grid-template-columns:5.5em 1fr;gap:3px 10px;margin-bottom:22px}
.label dt{color:#666}
.label .prose{font-size:14px;line-height:1.5}
.figs figure+figure{margin-top:48px}
.figs img{max-height:82vh;width:auto;max-width:100%}
.figs figcaption{margin-top:8px;color:#666}
.figs figcaption i{font-style:normal;color:#1a1a1a}
.crumb{margin-bottom:40px;color:#666}
.crumb a:hover{color:#1a1a1a}
@media(max-width:900px){.plates{grid-template-columns:repeat(2,1fr)}.cat{grid-template-columns:1fr}.label{position:static}}
`;
	const header = `<header><h1><a href="o2-home.html">Matthew Lau</a></h1><nav class="lab"><a href="About.html">Biography</a> &nbsp;&nbsp; <a href="mailto:matt@matthewlaujh.com">matt@matthewlaujh.com</a></nav></header>`;
	const plates = works.map((w, i) => `<figure><a href="o2-project.html"><img src="${w.cover.src}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}"><figcaption class="lab"><b>${w.title}</b><span>${w.year}, ${w.category.toLowerCase()}</span></figcaption></a></figure>`).join('');
	out['o2-home'] = shell('Matthew Lau', css, `${header}<div class="intro prose">${introHTML}</div><div class="plates">${plates}</div><footer class="lab"><span>Singapore</span><span>© Matthew Lau</span></footer>`);
	const w = feature;
	out['o2-project'] = shell(w.title, css, `${header}<p class="crumb lab"><a href="o2-home.html">Works</a> / ${w.category}</p>
<div class="cat"><aside class="label"><h1>${w.title}</h1><p class="yr lab">${w.year}</p><dl class="lab"><dt>Category</dt><dd>${w.category}</dd><dt>Context</dt><dd>${fix(w.context, 'o2')}</dd><dt>Plates</dt><dd>${w.images.length}</dd></dl><div class="prose">${fix(w.body, 'o2')}</div></aside>
<div class="figs">${w.images.map((im, i) => `<figure><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}"><figcaption class="lab">Fig. ${i + 1} &nbsp;<i>${w.title}</i>, ${w.year}</figcaption></figure>`).join('')}</div></div>
<footer class="lab"><a href="o2-home.html">← All works</a><span>© Matthew Lau</span></footer>`);
}

/* =====================================================================
   O3 — LIGHTBOX. Black room, one image at a time, index as an overlay.
   ===================================================================== */
{
	const css = `
body{background:#000;color:#fff;font:300 13px/1.4 "Atlas Grotesk",Helvetica,Arial,sans-serif;height:100vh;overflow:hidden}
.ui{position:fixed;left:24px;right:24px;z-index:5;display:flex;justify-content:space-between;pointer-events:none}
.ui>*{pointer-events:auto}
.ui.top{top:20px;z-index:11}.ui.bot{bottom:20px;align-items:flex-end}
.ui button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.ui a:hover,.ui button:hover{text-decoration:underline;text-underline-offset:3px}
.cap{font:300 17px/1.3 "Austin News Deck",Georgia,serif}
.cap span{display:block;font:300 12px/1.4 "Atlas Grotesk",sans-serif;color:#999;margin-top:3px}
.stage{position:absolute;inset:0}
.stage .s{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease}
.stage .s.on{opacity:1}
.stage img{width:100%;height:100%;object-fit:contain;padding:70px 24px 80px}
.hit{position:absolute;top:0;bottom:0;width:50%;cursor:w-resize}.hit.n{right:0;cursor:e-resize}
#index{position:fixed;inset:0;z-index:10;background:rgba(0,0,0,.9);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);overflow:auto;padding:80px 24px 40px;display:none}
body.ix #index{display:block}
#index .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;max-width:1100px}
#index h2{font:300 12px/1.4 "Atlas Grotesk",sans-serif;color:#999;margin-bottom:8px}
#index li a{display:block;font:300 22px/1.25 "Austin News Deck",serif;padding:3px 0}
#index li a:hover{color:#999}
#index .intro{max-width:60ch;margin:48px 0 0;color:#ccc;font:300 15px/1.5 "Austin News Deck",serif}
#index .intro p+p{margin-top:.5em}
.cnt{color:#999}
/* project: vertical snap */
body.pj{overflow:auto;height:auto;scroll-snap-type:y mandatory}
.pj .sl{height:100vh;scroll-snap-align:start;display:flex;align-items:center;justify-content:center;padding:70px 24px 80px}
.pj .sl img{max-width:100%;max-height:100%;width:auto;height:auto}
.pj .txt{height:auto;min-height:100vh;align-items:flex-start;padding-top:100px}
.pj .txt .prose{max-width:48rem;font:300 19px/1.45 "Austin News Deck",serif}
.pj .txt dl{display:grid;grid-template-columns:7em 1fr;gap:4px 12px;margin-bottom:32px;color:#999}
.pj .txt dd{color:#fff}
@media(max-width:800px){#index .cols{grid-template-columns:1fr}}
`;
	const slides = works.map((w, i) => `<div class="s${i === 0 ? ' on' : ''}" data-t="${esc(w.title)}" data-y="${w.year} — ${w.category}"><img src="${w.cover.src}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"></div>`).join('');
	const index = `<div id="index"><div class="cols">${nav.groups.map(g => `<section><h2>${g.label}</h2><ul>${g.items.map(i => i.href && bySlug[i.href] ? `<li><a href="o3-project.html">${i.text.replace(/\s*\(\d{4}[^)]*\)$/, '')}</a></li>` : `<li><a style="color:#666" href="#">${i.text.replace(/\s*\(\d{4}[^)]*\)$/, '')}</a></li>`).join('')}</ul></section>`).join('')}</div><div class="intro prose">${introHTML}</div></div>`;
	const ui = (mode) => `<div class="ui top"><a href="o3-home.html">Matthew Lau</a><button type="button" id="ixb">Index</button></div>`;
	out['o3-home'] = shell('Matthew Lau', css, `${ui()}<div class="stage" id="stage">${slides}<div class="hit p"></div><div class="hit n"></div></div>${index}
<div class="ui bot"><a class="cap" href="o3-project.html" id="cap">${works[0].title}<span>${works[0].year} — ${works[0].category}</span></a><span class="cnt" id="cnt">1 / ${works.length}</span></div>`,
	`var ss=[].slice.call(document.querySelectorAll('.stage .s')),i=0,cap=document.getElementById('cap'),cnt=document.getElementById('cnt');function show(n){i=(n+ss.length)%ss.length;ss.forEach(function(s,k){s.classList.toggle('on',k===i)});cap.innerHTML=ss[i].dataset.t+'<span>'+ss[i].dataset.y+'</span>';cnt.textContent=(i+1)+' / '+ss.length;var nx=ss[(i+1)%ss.length].querySelector('img');nx.loading='eager'}var t=setInterval(function(){show(i+1)},4500);document.querySelector('.hit.p').onclick=function(){clearInterval(t);show(i-1)};document.querySelector('.hit.n').onclick=function(){clearInterval(t);show(i+1)};document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){clearInterval(t);show(i+1)}if(e.key==='ArrowLeft'){clearInterval(t);show(i-1)}if(e.key==='Escape')document.body.classList.remove('ix')});document.getElementById('ixb').onclick=function(){var o=document.body.classList.toggle('ix');this.textContent=o?'Close':'Index'};`);
	const w = feature;
	out['o3-project'] = shell(w.title, css, `${ui()}${index}
<main class="pj">${w.images.map((im, i) => `<section class="sl"><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}"></section>`).join('')}
<section class="sl txt"><div><dl><dt>Work</dt><dd class="cap">${w.title}</dd><dt>Year</dt><dd>${w.year}</dd><dt>Category</dt><dd>${w.category}</dd><dt>Context</dt><dd>${fix(w.context, 'o3')}</dd></dl><div class="prose">${fix(w.body, 'o3')}</div></div></section></main>
<div class="ui bot"><span class="cap">${w.title}<span>${w.year} — ${w.category}</span></span><a href="o3-home.html">Close</a></div>`,
	`document.body.classList.add('pj');document.getElementById('ixb').onclick=function(){var o=document.body.classList.toggle('ix');this.textContent=o?'Close':'Index'};document.addEventListener('keydown',function(e){if(e.key==='Escape')document.body.classList.remove('ix')});`);
}

/* =====================================================================
   O4 — MONOGRAPH. Slow single column, serif, one plate per work.
   ===================================================================== */
{
	const css = `
body{background:#fbfbfa;color:#141414;font:300 18px/1.5 "Austin News Deck",Georgia,serif;padding:40px 0 120px}
.col{max-width:880px;margin-left:auto;margin-right:auto;padding:0 24px}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:96px}
header .nm{font-size:22px}
header nav{font:300 13px/1.4 "Atlas Grotesk",sans-serif;display:flex;gap:20px}
.lede{font-size:28px;line-height:1.3;margin-bottom:128px}.lede p{max-width:26em}
.lede p+p{margin-top:.6em}
.work{margin-bottom:128px}
.work img{max-height:80vh;width:auto;max-width:100%;margin:0 auto}
.work .cap{display:flex;justify-content:space-between;gap:24px;margin-top:14px;font:300 13px/1.45 "Atlas Grotesk",sans-serif}
.work .cap b{font:300 18px/1.3 "Austin News Deck",serif}
.work .cap span{color:#777;text-align:right;max-width:28em}
.work a:hover b{text-decoration:underline;text-underline-offset:4px}
.sec{font:300 13px/1.4 "Atlas Grotesk",sans-serif;color:#777;border-top:1px solid #141414;padding-top:8px;margin:0 0 48px}
footer{font:300 13px/1.4 "Atlas Grotesk",sans-serif;color:#777;display:flex;justify-content:space-between;border-top:1px solid #141414;padding-top:12px}
/* project */
.pt h1{font-size:40px;line-height:1.1;font-weight:300;margin-bottom:8px}
.pt .ctx{font:300 13px/1.45 "Atlas Grotesk",sans-serif;color:#777;margin-bottom:56px}
.pt .prose{max-width:34em;font-size:19px;line-height:1.5}
.pt figure{margin:56px 0}
.pt figcaption{margin-top:10px;font:300 13px/1.45 "Atlas Grotesk",sans-serif;color:#777}
.pt .back{font:300 13px/1.4 "Atlas Grotesk",sans-serif;display:block;margin-bottom:64px}
`;
	const header = `<header class="col"><a class="nm" href="o4-home.html">Matthew Lau</a><nav><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></nav></header>`;
	let homeBody = `${header}<div class="col lede prose">${introHTML}</div>`;
	for (const g of nav.groups) {
		homeBody += `<div class="col"><p class="sec">${g.label}</p></div>`;
		for (const w of works.filter(x => x.category === g.label)) {
			homeBody += `<section class="col work"><a href="o4-project.html"><img src="${w.cover.src}" alt="" loading="lazy"><div class="cap"><b>${w.title}, ${w.year}</b><span>${w.context.replace(/<[^>]+>/g, '').slice(0, 90)}</span></div></a></section>`;
		}
	}
	homeBody += `<footer class="col"><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`;
	out['o4-home'] = shell('Matthew Lau', css, homeBody);
	const w = feature;
	const paras = w.body.split(/\n(?=<p>|<hr>|<ul>)/);
	let pbody = `${header}<main class="col pt"><a class="back" href="o4-home.html">← All work</a><h1>${w.title}</h1><p class="ctx">${w.year} — ${w.category}. ${fix(w.context, 'o4')}</p>`;
	// interleave: image, para, image, para…
	const imgs = w.images.slice();
	pbody += `<figure><img src="${imgs.shift().src}" alt=""><figcaption>1</figcaption></figure>`;
	let n = 2;
	paras.forEach((p, i) => { pbody += `<div class="prose">${fix(p, 'o4')}</div>`; if (imgs.length && i % 2 === 1) { pbody += `<figure><img src="${imgs.shift().src}" alt="" loading="lazy"><figcaption>${n++}</figcaption></figure>`; } });
	imgs.forEach(im => { pbody += `<figure><img src="${im.src}" alt="" loading="lazy"><figcaption>${n++}</figcaption></figure>`; });
	pbody += `</main><footer class="col"><a href="o4-home.html">← All work</a><span>Next: Deconstructed Ambiance →</span></footer>`;
	out['o4-project'] = shell(w.title, css, pbody);
}

/* =====================================================================
   O5 — GRID. Swiss boutique: strict 3-column grid, category filters.
   ===================================================================== */
{
	const css = `
body{background:#fff;color:#000;font:300 13px/1.4 "Atlas Grotesk",Helvetica,Arial,sans-serif;padding:16px 16px 80px}
header{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;align-items:baseline}
header .f{display:flex;gap:14px}
header .f button{font:inherit;color:#999;background:none;border:0;padding:0;cursor:pointer}
header .f button.on,header .f button:hover{color:#000}
header .r{text-align:right}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.grid a{position:relative;display:block;background:#f0f0f0}
.grid img{width:100%;aspect-ratio:1;object-fit:cover}
.grid .t{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;background:#fff;opacity:0;transition:opacity .15s;display:flex;justify-content:space-between}
.grid a:hover .t{opacity:1}
.grid a.hide{display:none}
.intro{grid-column:1/-1;max-width:62ch;font:300 17px/1.45 "Austin News Deck",serif;padding:24px 0 40px}
.intro p+p{margin-top:.5em}
footer{position:fixed;left:0;right:0;bottom:0;padding:12px 16px;background:#fff;display:flex;justify-content:space-between;color:#999}
/* project */
.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start}
.pg .txt{grid-column:1;position:sticky;top:16px}
.pg .txt h1{font:300 24px/1.2 "Austin News Deck",serif;margin-bottom:6px}
.pg .txt .m{color:#999;margin-bottom:24px}
.pg .txt .prose{font:300 15px/1.45 "Austin News Deck",serif}
.pg .ims{grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pg .ims img{width:100%}
.pg .ims .wide{grid-column:1/-1}
.pn{margin-top:32px;display:flex;justify-content:space-between;color:#999}
@media(max-width:800px){header,.grid,.pg{grid-template-columns:1fr}.pg .txt{position:static}.pg .ims{grid-column:1}.header .r{text-align:left}}
`;
	const header = (filters) => `<header><a href="o5-home.html">Matthew Lau</a>${filters ? `<div class="f"><button class="on" data-f="all">All</button>${nav.groups.map(g => `<button data-f="${g.label}">${g.label}</button>`).join('')}</div>` : '<span></span>'}<div class="r"><a href="About.html">About</a> &nbsp; <a href="mailto:matt@matthewlaujh.com">Email</a></div></header>`;
	const tiles = works.map((w, i) => `<a href="o5-project.html" data-c="${w.category}"><img src="${w.cover.src}" alt="" loading="${i < 6 ? 'eager' : 'lazy'}"><span class="t"><span>${w.title}</span><span>${w.year}</span></span></a>`).join('');
	out['o5-home'] = shell('Matthew Lau', css, `${header(true)}<div class="grid"><div class="intro prose">${introHTML}</div>${tiles}</div><footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`,
	`document.querySelectorAll('.f button').forEach(function(b){b.onclick=function(){document.querySelectorAll('.f button').forEach(function(x){x.classList.toggle('on',x===b)});var f=b.dataset.f;document.querySelectorAll('.grid a').forEach(function(a){a.classList.toggle('hide',f!=='all'&&a.dataset.c!==f)})}});`);
	const w = feature;
	out['o5-project'] = shell(w.title, css, `${header(false)}<div class="pg"><aside class="txt"><h1>${w.title}</h1><p class="m">${w.year} — ${w.category}<br>${fix(w.context, 'o5')}</p><div class="prose">${fix(w.body, 'o5')}</div><nav class="pn"><a href="o5-home.html">← Index</a><a href="o5-project.html">Next →</a></nav></aside>
<div class="ims">${w.images.map((im, i) => `<img class="${i === 0 ? 'wide' : ''}" src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}">`).join('')}</div></div><footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`);
}

/* =====================================================================
   O6 — TYPOGRAPHIC. Keeps the dark slitscan; titles set large; image follows cursor.
   ===================================================================== */
{
	const css = `
body{background:#222;color:#fff;font:300 13px/1.4 "Atlas Grotesk",Helvetica,Arial,sans-serif;min-height:100vh;padding:24px 28px 28px}
.bg{position:fixed;inset:0;z-index:0;background:url(img/4a927375-webgl-bg.jpg) center/cover;opacity:.55;filter:saturate(.8)}
.wrap{position:relative;z-index:1}
header{display:flex;justify-content:space-between;margin-bottom:9vh}
header nav{display:flex;gap:22px}
.list a{display:block;font:300 clamp(28px,4.2vw,64px)/1.05 "Austin News Deck",Georgia,serif;padding:.06em 0;color:rgba(255,255,255,.92)}
.list a:hover{color:#fff;font-style:italic}
.list a small{font:300 13px/1 "Atlas Grotesk",sans-serif;vertical-align:top;margin-left:.6em;color:rgba(255,255,255,.6)}
.list .g{font:300 13px/1.4 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.6);margin:28px 0 6px}
.cur{position:fixed;z-index:3;width:26vw;pointer-events:none;opacity:0;transition:opacity .15s;transform:translate(16px,16px)}
.cur.on{opacity:1}
.cur img{width:100%}
.intro{max-width:52ch;margin-top:12vh;font:300 17px/1.45 "Austin News Deck",serif;color:rgba(255,255,255,.85)}
.intro p+p{margin-top:.5em}
footer{position:relative;z-index:1;margin-top:10vh;display:flex;justify-content:space-between;color:rgba(255,255,255,.6)}
/* project */
.pt h1{font:300 clamp(36px,6vw,92px)/1 "Austin News Deck",serif;margin:0 0 20px;max-width:14em}
.pt .m{color:rgba(255,255,255,.6);margin-bottom:56px}
.pt .lay{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:40px;align-items:start}
.pt .prose{position:sticky;top:24px;font:300 16px/1.5 "Austin News Deck",serif;max-width:34em}
.pt .ims{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.pt .ims img{width:100%}
.pt .ims .wide{grid-column:1/-1}
.pt .back{display:inline-block;margin-bottom:40px;color:rgba(255,255,255,.6)}
@media(max-width:800px){.pt .lay{grid-template-columns:1fr}.pt .prose{position:static}.cur{display:none}}
`;
	const header = `<header><a href="o6-home.html">Matthew Lau</a><nav><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></nav></header>`;
	let list = '';
	for (const g of nav.groups) {
		list += `<p class="g">${g.label}</p>`;
		for (const w of works.filter(x => x.category === g.label)) list += `<a href="o6-project.html" data-img="${w.cover.src}">${w.title}<small>${w.year}</small></a>`;
	}
	out['o6-home'] = shell('Matthew Lau', css, `<div class="bg"></div><div class="wrap">${header}<div class="list">${list}</div><div class="intro prose">${introHTML}</div></div><div class="cur" id="cur"><img alt=""></div><footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`,
	`var c=document.getElementById('cur'),im=c.querySelector('img');document.querySelectorAll('.list a').forEach(function(a){a.addEventListener('mouseenter',function(){im.src=a.dataset.img;c.classList.add('on')});a.addEventListener('mouseleave',function(){c.classList.remove('on')})});window.addEventListener('mousemove',function(e){c.style.left=Math.min(e.clientX,innerWidth-c.offsetWidth-32)+'px';c.style.top=Math.min(e.clientY,innerHeight-c.offsetHeight-32)+'px'});`);
	const w = feature;
	out['o6-project'] = shell(w.title, css, `<div class="bg"></div><div class="wrap pt">${header}<a class="back" href="o6-home.html">← Work</a><h1>${w.title}</h1><p class="m">${w.year} — ${w.category}. ${fix(w.context, 'o6')}</p><div class="lay"><div class="prose">${fix(w.body, 'o6')}</div><div class="ims">${w.images.map((im, i) => `<img class="${i === 0 ? 'wide' : ''}" src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}">`).join('')}</div></div></div><footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`);
}

/* ------------------------------------------------------------------ hub */
const hubCss = `body{background:#fff;color:#111;font:300 14px/1.5 "Atlas Grotesk",sans-serif;padding:40px;max-width:60rem}h1{font:300 28px/1.2 "Austin News Deck",serif;margin-bottom:24px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px 16px 10px 0;border-bottom:1px solid #ddd;vertical-align:top}th{font-weight:300;color:#888}td b{font-weight:300;font-family:"Austin News Deck",serif;font-size:18px}a{text-decoration:underline;text-underline-offset:3px}p{color:#666;margin-top:24px;max-width:60ch}`;
const opts = [
	['o1', 'Index', 'Downtown studio. One grotesk, one table of works; hover a row to see it.', 'white'],
	['o2', 'Wall label', 'Museum catalogue: plate grid, sticky label column, figure numbers.', 'grey paper'],
	['o3', 'Lightbox', 'Black room, one image at a time; the index is an overlay.', 'black'],
	['o4', 'Monograph', 'Slow single column, serif, one plate per work, essay-style project page.', 'off-white'],
	['o5', 'Grid', 'Swiss boutique: strict 3-up square grid with category filters.', 'white'],
	['o6', 'Typographic', 'Keeps the slit-scan. Titles set large; cover image follows the cursor.', 'dark']
];
out['options'] = shell('Six directions', hubCss, `<h1>Six directions for matthewlaujh.com</h1><table><tr><th></th><th>Direction</th><th>Idea</th><th>Ground</th><th>Home</th><th>Project</th></tr>${opts.map(o => `<tr><td>${o[0].toUpperCase()}</td><td><b>${o[1]}</b></td><td>${o[2]}</td><td>${o[3]}</td><td><a href="${o[0]}-home.html">home</a></td><td><a href="${o[0]}-project.html">project</a></td></tr>`).join('')}</table><p>All six run on the real content and images (the project page is always Ambi(latent) Space). Only the home and one project page are built per direction; About and the other projects link to the current v2 pages.</p>`);

for (const [name, html] of Object.entries(out)) fs.writeFileSync(path.join(OUT, name + '.html'), html);
console.log(Object.keys(out).length + ' prototype pages written');
