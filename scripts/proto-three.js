#!/usr/bin/env node
/*
 * Round 2: three richer directions grown from O1 (Index) and O6 (Typographic).
 *   node scripts/proto-three.js -> preview/o7-*, o8-*, o9-*  (+ options.html updated)
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
	.replace(/<p><a[^>]*>Click here for more about me\.<\/a><\/p>/, '').replace(/<hr>\s*$/, '');
const SLIT = JSON.stringify({ settings: home.backdrop.settings, image: Object.assign({}, home.backdrop.image, { src: home.backdrop.image.src.replace(/^\//, '') }) });

const works = nav.groups.flatMap(g => g.items.filter(i => i.href && bySlug[i.href]).map(i => {
	const p = bySlug[i.href];
	const prose = convert.prose(p.content);
	const paras = prose.split(/\n(?=<)/);
	const firstP = paras.find(x => x.startsWith('<p>')) || '';
	const context = firstP.replace(/<\/?p>/g, '');
	const rest = prose.replace(firstP, '').replace(/^\s*<hr>\s*/, '').replace(/<hr>\s*$/, '');
	const title = p.title_no_html.replace(/\s*\(\d{4}(?:[–-]\d{4})?\)\s*$/, '').replace(/,\s*$/, '');
	const year = (p.title_no_html.match(/\((\d{4}(?:[–-]\d{4})?)\)/) || [])[1] || '';
	const images = p.images.map(im => ({ src: im.src.replace(/^\//, ''), w: im.width, h: im.height }));
	const firstText = rest.split(/\n(?=<)/).find(x => x.startsWith('<p>') && x.replace(/<[^>]+>/g, '').length > 90) || '';
	return { slug: p.slug, title, year, category: g.label, context, body: rest, images, cover: images[0], blurb: firstText.replace(/<[^>]+>/g, '').slice(0, 220) };
}));
const feature = works.find(w => w.slug === 'Ambi-latent-Space-2025');
const next = works[(works.indexOf(feature) + 1) % works.length];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function fix(html, v) {
	return html.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, href, post, inner) => {
		if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(href)) return bySlug[href] ? `<a href="${v}-project.html">${inner}</a>` : inner;
		return `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;
	});
}

const BASE_CSS = `
@font-face{font-family:"Austin News Deck";font-weight:300;font-style:normal;src:url(fonts/AustinNewsDeck-Light.otf) format("opentype")}
@font-face{font-family:"Austin News Deck";font-weight:300;font-style:italic;src:url(fonts/AustinNewsDeck-LightItalic.otf) format("opentype")}
@font-face{font-family:"Atlas Grotesk";font-weight:300;font-style:normal;src:url(fonts/AtlasGrotesk-Light.otf) format("opentype")}
@font-face{font-family:"Atlas Grotesk";font-weight:300;font-style:italic;src:url(fonts/AtlasGrotesk-LightItalic.otf) format("opentype")}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:none}
body{margin:0;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:inherit;text-decoration:none}
a:focus-visible,button:focus-visible{outline:1px solid currentColor;outline-offset:3px}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
img{display:block;max-width:100%;height:auto}
p,h1,h2,h3,ul,dl,dd,figure{margin:0}
ul{padding:0;list-style:none}
.prose p+p,.prose ul+p,.prose p+ul{margin-top:.6em}
.prose hr{border:0;border-top:1px solid currentColor;opacity:.3;margin:1em 0;width:2em}
.prose ul{padding-left:1.1em;list-style:disc}
.prose i{font-style:italic}
.prose a{text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(128,128,128,.5)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.backdrop{position:fixed;inset:0;z-index:0;overflow:hidden;opacity:0;transition:opacity .8s}
.backdrop.loaded{opacity:1}
.backdrop canvas{position:absolute;inset:0;width:100%;height:100%;background:#000}
.veil{position:fixed;inset:0;z-index:0;background:rgba(0,0,0,.38);pointer-events:none}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
const shell = (title, css, body, js, slit) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}${css}</style>${slit ? '<script src="js/backdrops.js" defer></script>' : ''}</head><body>${body}<script>${js || ''}</script></body></html>`;
const slitHTML = () => `<div class="backdrop" data-backdrop="slitscan" aria-hidden="true"><script type="application/json">${SLIT}</script></div><div class="veil" aria-hidden="true"></div>`;
const out = {};

/* =====================================================================
   O7 — LEDGER. O1's table, alive: rows expand in place, hover scrubs the
   project's images, filters slide, counter ticks. Project page keeps the
   table as a dropdown behind the title.
   ===================================================================== */
{
	const css = `
:root{--ink:#111;--dim:#8a8a8a;--rule:#dcdcdc;--pad:24px}
body{background:#fff;color:var(--ink);font:300 13px/1.45 "Atlas Grotesk",Helvetica,Arial,sans-serif;padding:20px var(--pad) 90px}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:56px;position:relative;z-index:20}
header nav{display:flex;gap:22px}
header nav a{position:relative}
header nav a::after,.f button::after{content:"";position:absolute;left:0;right:100%;bottom:-3px;height:1px;background:var(--ink);transition:right .25s cubic-bezier(.3,0,.2,1)}
header nav a:hover::after,header nav a[aria-current]::after,.f button.on::after{right:0}
.intro{max-width:52ch;margin-bottom:56px}
.intro p+p{margin-top:.6em}
.f{display:flex;gap:18px;margin-bottom:10px;color:var(--dim)}
.f button{position:relative;padding-bottom:3px}
.f button.on,.f button:hover{color:var(--ink)}
.f .n{margin-left:auto;font-variant-numeric:tabular-nums}
.ledger{width:100%;border-collapse:collapse;border-top:1px solid var(--ink)}
.ledger td{padding:9px 24px 9px 0;border-bottom:1px solid var(--rule);vertical-align:top;transition:color .2s}
.ledger .r{cursor:pointer}
.ledger .r td{opacity:0;transform:translateY(6px);animation:in .5s cubic-bezier(.2,.6,.2,1) forwards}
.ledger .r:hover td,.ledger .r.open td{color:var(--dim)}
.ledger .r:hover td.t,.ledger .r.open td.t{color:var(--ink)}
.ledger .r.hide,.ledger .x.hide{display:none}
td.y{width:4em;font-variant-numeric:tabular-nums}
td.c{width:9em}
td.i{width:6em;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.t{width:58%}
td.t .arrow{display:inline-block;margin-left:.5em;opacity:0;transform:translateX(-4px);transition:.2s}
.ledger .r:hover .arrow{opacity:1;transform:none}
.ledger .r.open .arrow{transform:rotate(90deg);opacity:1}
.x td{padding:0;border-bottom:0}
.x .box{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.3,0,.2,1)}
.x.open .box{grid-template-rows:1fr}
.x .box>div{overflow:hidden}
.x .in{display:grid;grid-template-columns:1fr 1.6fr;gap:32px;padding:18px 0 28px;border-bottom:1px solid var(--rule)}
.x .in p{max-width:44ch;color:var(--dim)}
.x .in .go{display:inline-block;margin-top:14px;color:var(--ink);border-bottom:1px solid var(--ink)}
.x .strip{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.x .strip::-webkit-scrollbar{display:none}
.x .strip img{height:120px;width:auto;flex:none;opacity:0;transform:translateY(8px);transition:.4s cubic-bezier(.2,.6,.2,1)}
.x.open .strip img{opacity:1;transform:none}
.peek{position:fixed;right:var(--pad);bottom:62px;width:26vw;z-index:5;background:#fff;padding:10px 0 8px 10px;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .3s cubic-bezier(.2,.6,.2,1)}
.peek.on{opacity:1;transform:none}
.peek .frame{position:relative;aspect-ratio:3/2;background:#f2f2f2;overflow:hidden}
.peek img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0}
.peek img.on{opacity:1}
.peek .bar{display:flex;gap:3px;margin-top:6px}
.peek .bar i{flex:1;height:1px;background:var(--rule)}
.peek .bar i.on{background:var(--ink)}
.peek figcaption{display:flex;justify-content:space-between;margin-top:6px;color:var(--dim)}
footer{position:fixed;left:0;right:0;bottom:0;padding:14px var(--pad);background:#fff;display:flex;justify-content:space-between;color:var(--dim);z-index:4}
@keyframes in{to{opacity:1;transform:none}}
/* ---- project */
.bar2{position:sticky;top:0;z-index:30;background:#fff;margin:0 calc(-1*var(--pad));padding:14px var(--pad);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid var(--rule)}
.bar2 .back{display:inline-flex;align-items:center;gap:8px}
.bar2 .back span{display:inline-block;transition:transform .25s}
.bar2 .back:hover span{transform:translateX(-4px)}
.bar2 .tt{display:inline-flex;align-items:center;gap:10px;font:300 15px/1 "Austin News Deck",serif}
.bar2 .tt b{font-weight:300;font-family:"Atlas Grotesk",sans-serif;font-size:11px;color:var(--dim)}
.bar2 .tt svg{width:10px;height:10px;transition:transform .3s}
.bar2 .tt[aria-expanded=true] svg{transform:rotate(180deg)}
.bar2 .right{text-align:right}
.dd{position:fixed;left:0;right:0;top:0;z-index:29;background:#fff;border-bottom:1px solid var(--ink);padding:84px var(--pad) 28px;display:grid;grid-template-columns:repeat(3,1fr);gap:32px;transform:translateY(-8px);opacity:0;visibility:hidden;transition:.3s cubic-bezier(.3,0,.2,1)}
.dd.on{transform:none;opacity:1;visibility:visible}
.dd h3{font-weight:300;color:var(--dim);margin:0 0 8px}.dd a{display:block;padding:3px 0;color:var(--ink)}.dd a small{color:var(--dim);margin-left:.5em}.dd a:hover{padding-left:8px;transition:.2s}.dd a[aria-current]{text-decoration:underline;text-underline-offset:3px}
.scrim{position:fixed;inset:0;z-index:28;background:rgba(255,255,255,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;visibility:hidden;transition:.3s}
.scrim.on{opacity:1;visibility:visible}
.pj{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:32px 56px;padding-top:40px;align-items:start}
.pj aside{position:sticky;top:70px}
.pj h1{font:300 30px/1.1 "Austin News Deck",serif;margin-bottom:18px}
.pj dl{display:grid;grid-template-columns:7em 1fr;gap:4px 12px;border-top:1px solid var(--ink);padding-top:10px;margin-bottom:24px}
.pj dt{color:var(--dim)}
.pj .prose{max-width:44ch}
.plates figure{margin-bottom:28px}
.plates figure img{clip-path:inset(0 0 100% 0);transition:clip-path 1s cubic-bezier(.2,.6,.2,1)}
.plates figure.seen img{clip-path:inset(0)}
.plates figcaption{display:flex;justify-content:space-between;margin-top:6px;color:var(--dim);font-variant-numeric:tabular-nums}
.pn{display:flex;justify-content:space-between;margin-top:40px;padding-top:12px;border-top:1px solid var(--ink)}
.pn a span{display:inline-block;transition:transform .25s}
.pn a:hover span{transform:translateX(4px)}
.prog{position:fixed;left:0;top:0;height:2px;background:var(--ink);width:0;z-index:40}
@media(max-width:800px){.pj{grid-template-columns:1fr}.pj aside{position:static}.peek{display:none}td.i,td.c{display:none}.x .in{grid-template-columns:1fr}.bar2{grid-template-columns:auto 1fr auto}}
`;
	const header = (cur) => `<header><a href="o7-home.html">Matthew Lau</a><nav><a href="o7-home.html"${cur === 'home' ? ' aria-current="page"' : ''}>Index</a><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></nav></header>`;
	const rows = (v, expandable) => works.map((w, i) => `<tr class="r" data-c="${w.category}" data-i="${i}" style="--d:${i * 35}ms" ${expandable ? '' : `onclick="location.href='${v}-project.html'"`}><td class="y">${w.year}</td><td class="t">${w.title}<span class="arrow">→</span></td><td class="c">${w.category}</td><td class="i">${w.images.length} img</td></tr>${expandable ? `<tr class="x" data-c="${w.category}"><td colspan="4"><div class="box"><div><div class="in"><div><p>${esc(w.blurb)}…</p><a class="go" href="${v}-project.html">Open project →</a></div><div class="strip">${w.images.slice(0, 8).map((im, k) => `<img src="${im.src}" alt="" loading="lazy" style="transition-delay:${k * 40}ms">`).join('')}</div></div></div></div></td></tr>` : ''}`).join('');
	const filters = `<div class="f"><button class="on" data-f="all">All</button>${nav.groups.map(g => `<button data-f="${g.label}">${g.label}</button>`).join('')}<span class="n" id="n">${works.length} works</span></div>`;
	const peek = `<figure class="peek" id="peek"><div class="frame" id="frame"></div><div class="bar" id="pbar"></div><figcaption><span id="pcap"></span><span id="pcnt"></span></figcaption></figure>`;
	const data = JSON.stringify(works.map(w => ({ t: w.title, y: w.year, im: w.images.slice(0, 8).map(i => i.src) })));
	const HOME_JS = `
var W=${data};
document.querySelectorAll('.ledger .r td').forEach(function(td){td.style.animationDelay=td.parentNode.style.getPropertyValue('--d')});
/* filters */
var n=document.getElementById('n');
document.querySelectorAll('.f button').forEach(function(b){b.onclick=function(){document.querySelectorAll('.f button').forEach(function(x){x.classList.toggle('on',x===b)});var f=b.dataset.f,c=0;document.querySelectorAll('.ledger tr').forEach(function(r){var h=f!=='all'&&r.dataset.c!==f;r.classList.toggle('hide',h);if(r.classList.contains('r')&&!h)c++});tick(c)}});
function tick(to){var from=parseInt(n.textContent)||0,t0=performance.now();(function s(t){var k=Math.min(1,(t-t0)/300);n.textContent=Math.round(from+(to-from)*(1-Math.pow(1-k,3)))+' works';if(k<1)requestAnimationFrame(s)})(t0)}
/* expand */
document.querySelectorAll('.ledger .r').forEach(function(r){r.addEventListener('click',function(){var x=r.nextElementSibling,open=r.classList.contains('open');document.querySelectorAll('.r.open,.x.open').forEach(function(e){e.classList.remove('open')});if(!open){r.classList.add('open');x.classList.add('open');pk.classList.remove('on')}})});
/* scrub preview */
var pk=document.getElementById('peek'),fr=document.getElementById('frame'),pb=document.getElementById('pbar'),pc=document.getElementById('pcap'),pn=document.getElementById('pcnt'),cur=-1,imgs=[];
document.querySelectorAll('.ledger .r').forEach(function(r){
 r.addEventListener('mouseenter',function(){if(r.classList.contains('open'))return;var i=+r.dataset.i;if(i!==cur){cur=i;fr.innerHTML='';pb.innerHTML='';imgs=W[i].im.map(function(s,k){var im=new Image();im.src=s;im.alt='';fr.appendChild(im);var b=document.createElement('i');pb.appendChild(b);return im});pc.textContent=W[i].t+', '+W[i].y}pk.classList.add('on');scrub(r,null)});
 r.addEventListener('mousemove',function(e){scrub(r,e)});
 r.addEventListener('mouseleave',function(){pk.classList.remove('on')});
});
function scrub(r,e){var k=0;if(e){var b=r.getBoundingClientRect();k=Math.floor((e.clientX-b.left)/b.width*imgs.length);k=Math.max(0,Math.min(imgs.length-1,k))}imgs.forEach(function(im,j){im.classList.toggle('on',j===k)});[].forEach.call(pb.children,function(b,j){b.classList.toggle('on',j<=k)});pn.textContent=(k+1)+' / '+imgs.length}
`;
	out['o7-home'] = shell('Matthew Lau — Index', css, `${header('home')}<div class="intro prose">${introHTML}</div>${filters}<table class="ledger">${rows('o7', true)}</table>${peek}<footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`, HOME_JS);
	const w = feature;
	const PJ_JS = `
var tt=document.getElementById('tt'),dd=document.getElementById('dd'),sc=document.getElementById('scrim');
function tog(o){o=o===undefined?!dd.classList.contains('on'):o;dd.classList.toggle('on',o);sc.classList.toggle('on',o);tt.setAttribute('aria-expanded',o)}
tt.onclick=function(){tog()};sc.onclick=function(){tog(false)};document.addEventListener('keydown',function(e){if(e.key==='Escape')tog(false)});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}})},{rootMargin:'0px 0px -10% 0px'});
document.querySelectorAll('.plates figure').forEach(function(f){io.observe(f)});
var pr=document.getElementById('prog');addEventListener('scroll',function(){var h=document.documentElement;pr.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%'},{passive:true});
`;
	out['o7-project'] = shell(w.title, css, `<div class="prog" id="prog"></div><div class="bar2"><a class="back" href="o7-home.html"><span>←</span> Index</a><button class="tt" id="tt" aria-expanded="false" aria-controls="dd">${w.title} <b>${w.year}</b><svg viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M1 3l4 4 4-4"/></svg></button><div class="right"><a href="About.html">About</a> &nbsp;&nbsp; <a href="mailto:matt@matthewlaujh.com">Email</a></div></div>
<div class="scrim" id="scrim"></div><div class="dd" id="dd">${nav.groups.map(g => `<section><h3>${g.label}</h3>${works.filter(x => x.category === g.label).map(x => `<a href="o7-project.html"${x === w ? ' aria-current="page"' : ''}>${x.title}<small>${x.year}</small></a>`).join('')}</section>`).join('')}</div>
<div class="pj"><div class="plates">${w.images.map((im, i) => `<figure><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}"><figcaption><span>${w.title}</span><span>${i + 1} / ${w.images.length}</span></figcaption></figure>`).join('')}</div>
<aside><h1>${w.title}</h1><dl><dt>Year</dt><dd>${w.year}</dd><dt>Category</dt><dd>${w.category}</dd><dt>Context</dt><dd>${fix(w.context, 'o7')}</dd></dl><div class="prose">${fix(w.body, 'o7')}</div><nav class="pn"><a href="o7-home.html">← Index</a><a href="o7-project.html">${next.title} <span>→</span></a></nav></aside></div>
<footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer>`, PJ_JS);
}

/* =====================================================================
   O8 — MARQUEE. O6 with the real slit-scan behind it. Titles split into
   letters that italicise in a wave; the cover trails the cursor with lag
   and tilts with velocity; the backdrop speeds up while you hover.
   ===================================================================== */
{
	const css = `
body{background:#111;color:#fff;font:300 13px/1.4 "Atlas Grotesk",Helvetica,Arial,sans-serif;min-height:100vh;overflow-x:hidden}
.wrap{position:relative;z-index:1;padding:24px 28px 40px}
header{display:flex;justify-content:space-between;margin-bottom:8vh}
header nav{display:flex;gap:22px}
.list{position:relative}
.list .g{color:rgba(255,255,255,.55);margin:30px 0 4px;display:flex;align-items:center;gap:12px}
.list .g::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.18)}
.list a{display:block;font:300 clamp(28px,4.4vw,66px)/1.08 "Austin News Deck",Georgia,serif;padding:.04em 0;color:rgba(255,255,255,.9);transition:color .3s,padding-left .4s cubic-bezier(.2,.6,.2,1)}
.list a span.w{white-space:nowrap;display:inline-block}
.list a .ch{display:inline-block;transition:transform .25s,font-style 0s;transition-delay:var(--d)}
.list a:hover .ch{font-style:italic;transform:translateY(-.03em)}
.list:hover a:not(:hover){color:rgba(255,255,255,.3)}
.list a:hover{padding-left:.4em}
.list a small{font:300 12px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.55);vertical-align:top;margin-left:.6em;display:inline-block;padding-top:.5em}
.cur{position:fixed;left:0;top:0;z-index:3;width:24vw;pointer-events:none;opacity:0;transition:opacity .25s;will-change:transform;transform-origin:center}
.cur.on{opacity:1}
.cur img{width:100%;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.cur .cap{position:absolute;left:0;right:0;bottom:-20px;display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.6)}
.intro{max-width:52ch;margin-top:12vh;font:300 17px/1.45 "Austin News Deck",serif;color:rgba(255,255,255,.85)}
.intro p+p{margin-top:.5em}
footer{margin-top:10vh;display:flex;justify-content:space-between;color:rgba(255,255,255,.55)}
/* project */
.top{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:16px 28px 22px;background:linear-gradient(rgba(17,17,17,.9),rgba(17,17,17,0))}
.top .mid{display:inline-flex;align-items:center;gap:10px;font:300 15px/1 "Austin News Deck",serif;opacity:0;transform:translateY(6px);transition:.3s}
.top .mid.show{opacity:1;transform:none}
.top .mid svg{width:10px;height:10px;transition:transform .3s}.top .mid[aria-expanded=true] svg{transform:rotate(180deg)}
.top .r{text-align:right}
.menu{position:fixed;inset:0;z-index:4;background:rgba(17,17,17,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:90px 28px 40px;overflow:auto;opacity:0;visibility:hidden;transition:.35s}
.menu.on{opacity:1;visibility:visible}
.menu .list a{font-size:clamp(22px,3vw,40px)}.menu .list a .ch{transition:none}
.hero{height:88vh;display:flex;flex-direction:column;justify-content:flex-end;padding:0 28px 40px;position:relative}
.hero h1{font:300 clamp(44px,8.5vw,128px)/.95 "Austin News Deck",serif;letter-spacing:-.01em;max-width:11em}
.hero h1 .ch{display:inline-block;opacity:0;transform:translateY(.4em) rotate(2deg);animation:rise .9s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:var(--d)}
.hero .m{margin-top:20px;color:rgba(255,255,255,.6);max-width:60ch;opacity:0;animation:rise .9s .6s forwards}
@keyframes rise{to{opacity:1;transform:none}}
.body{position:relative;z-index:1;background:#111;padding:60px 28px 80px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:48px;align-items:start}
.body .prose{position:sticky;top:70px;font:300 16px/1.5 "Austin News Deck",serif;max-width:34em}
.body .ims figure{margin-bottom:28px;position:relative;overflow:hidden}
.body .ims img{width:100%;transform:scale(1.06);transition:transform 1.4s cubic-bezier(.2,.6,.2,1)}
.body .ims figure.seen img{transform:none}
.body .ims figcaption{position:absolute;left:12px;bottom:10px;font-size:11px;color:#fff;mix-blend-mode:difference}
.pn{grid-column:1/-1;display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.2);padding-top:14px;color:rgba(255,255,255,.6)}
.pn a:hover{color:#fff}
@media(max-width:800px){.body{grid-template-columns:1fr}.body .prose{position:static}.cur{display:none}.list a:hover{padding-left:0}}
`;
	const split = (t, i0) => t.split(' ').map(word => `<span class="w">${[...word].map((c, k) => `<span class="ch" style="--d:${(i0 + k) * 18}ms">${c}</span>`).join('')}</span>`).join(' ');
	const listHTML = (v) => nav.groups.map(g => `<p class="g">${g.label}</p>${works.filter(x => x.category === g.label).map(w => `<a href="${v}-project.html" data-img="${w.cover.src}" data-t="${esc(w.title)}" data-y="${w.year}">${split(w.title, 0)}<small>${w.year}</small></a>`).join('')}`).join('');
	const header = `<header><a href="o8-home.html">Matthew Lau</a><nav><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></nav></header>`;
	const HOME_JS = `
var c=document.getElementById('cur'),im=c.querySelector('img'),cap=c.querySelector('.cap'),mx=innerWidth/2,my=innerHeight/2,x=mx,y=my,vx=0,vy=0,on=false,slit=null;
addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY});
function loop(){var nx=x+(mx-x)*.12,ny=y+(my-y)*.12;vx=nx-x;vy=ny-y;x=nx;y=ny;var w=c.offsetWidth,h=c.offsetHeight;var px=Math.min(x+24,innerWidth-w-24),py=Math.min(y+24,innerHeight-h-40);c.style.transform='translate('+px+'px,'+py+'px) rotate('+Math.max(-6,Math.min(6,vx*.25))+'deg) skewY('+Math.max(-4,Math.min(4,vy*.15))+'deg)';requestAnimationFrame(loop)}loop();
document.querySelectorAll('.list a').forEach(function(a){a.addEventListener('mouseenter',function(){im.src=a.dataset.img;cap.innerHTML='<span>'+a.dataset.t+'</span><span>'+a.dataset.y+'</span>';c.classList.add('on');bd(2.2)});a.addEventListener('mouseleave',function(){c.classList.remove('on');bd(1)})});
function bd(s){var el=document.querySelector('.backdrop');if(el&&el.__instance&&el.__instance.data)el.__instance.data.speedScale=s}
window.addEventListener('load',function(){if(window.MLBackdrops)MLBackdrops.init(document)});
`;
	out['o8-home'] = shell('Matthew Lau', css, `${slitHTML()}<div class="wrap">${header}<div class="list">${listHTML('o8')}</div><div class="intro prose">${introHTML}</div><footer><span>matt@matthewlaujh.com</span><span>Singapore</span></footer></div><div class="cur" id="cur"><img alt=""><div class="cap"></div></div>`, HOME_JS, true);
	const w = feature;
	const PJ_JS = `
window.addEventListener('load',function(){if(window.MLBackdrops)MLBackdrops.init(document)});
var mid=document.getElementById('mid'),mn=document.getElementById('menu');
addEventListener('scroll',function(){mid.classList.toggle('show',scrollY>innerHeight*.5||mn.classList.contains('on'))},{passive:true});
mid.onclick=function(){var o=mn.classList.toggle('on');mid.setAttribute('aria-expanded',o);mid.classList.add('show')};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){mn.classList.remove('on');mid.setAttribute('aria-expanded',false)}});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}})},{rootMargin:'0px 0px -15% 0px'});
document.querySelectorAll('.ims figure').forEach(function(f){io.observe(f)});
`;
	out['o8-project'] = shell(w.title, css, `${slitHTML()}<div class="top"><a href="o8-home.html">← Matthew Lau</a><button class="mid" id="mid" aria-expanded="false" aria-controls="menu">${w.title} <svg viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M1 3l4 4 4-4"/></svg></button><div class="r"><a href="About.html">About</a> &nbsp;&nbsp; <a href="mailto:matt@matthewlaujh.com">Email</a></div></div>
<div class="menu" id="menu"><div class="list">${listHTML('o8')}</div></div>
<section class="hero"><h1>${split(w.title, 0)}</h1><p class="m">${w.year} — ${w.category}. ${fix(w.context, 'o8')}</p></section>
<div class="body"><div class="prose">${fix(w.body, 'o8')}</div><div class="ims">${w.images.map((im, i) => `<figure><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}"><figcaption>${i + 1} / ${w.images.length}</figcaption></figure>`).join('')}</div><nav class="pn"><a href="o8-home.html">← All work</a><a href="o8-project.html">Next: ${next.title} →</a></nav></div>`, PJ_JS, true);
}

/* =====================================================================
   O9 — FIELD. Covers scattered as a drifting field over the slit-scan;
   the title list on the left pulls each one forward. Click: the cover
   expands into the project page (FLIP), whose strip is drag-scrolled.
   ===================================================================== */
{
	const css = `
body{background:#1a1a1a;color:#fff;font:300 13px/1.4 "Atlas Grotesk",Helvetica,Arial,sans-serif;height:100vh;overflow:hidden;cursor:default}
header{position:fixed;left:28px;right:28px;top:22px;z-index:6;display:flex;justify-content:space-between}
header nav{display:flex;gap:22px}
.field{position:absolute;inset:0;z-index:1;overflow:hidden}
.field a{position:absolute;width:var(--w);transform:translate(var(--x),var(--y)) translate(calc(var(--px)*var(--z)),calc(var(--py)*var(--z)));transition:filter .5s,opacity .5s;will-change:transform}
.field a img{width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.field a .l{position:absolute;left:0;top:100%;margin-top:8px;white-space:nowrap;opacity:0;transform:translateY(-4px);transition:.25s}
.field.focus a{filter:brightness(.25) blur(2px)}
.field.focus a.on{filter:none;z-index:3;opacity:1}
.field a.on .l{opacity:1;transform:none}
.field a:hover{filter:none;z-index:4}
.side{position:fixed;left:28px;top:50%;transform:translateY(-50%);z-index:5;width:min(34vw,420px)}
.side .g{color:rgba(255,255,255,.5);margin:14px 0 2px}
.side a{display:block;font:300 15px/1.3 "Austin News Deck",serif;padding:1px 0;color:rgba(255,255,255,.85);transition:color .2s,padding-left .3s cubic-bezier(.2,.6,.2,1)}
.side a:hover,.side a.on{color:#fff;padding-left:12px}
.side a small{font:300 11px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.5);margin-left:.6em}
.intro{position:fixed;right:28px;bottom:28px;z-index:5;max-width:34ch;font:300 14px/1.45 "Austin News Deck",serif;color:rgba(255,255,255,.8);padding:14px 16px;background:rgba(0,0,0,.35);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.intro p+p{margin-top:.4em}
.hint{position:fixed;left:28px;bottom:28px;z-index:5;color:rgba(255,255,255,.45)}
.flip{position:fixed;z-index:50;pointer-events:none;background:#000}
.flip img{width:100%;height:100%;object-fit:cover}
/* project */
body.pj{overflow:auto;height:auto;background:#161616}
.top{position:sticky;top:0;z-index:7;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:16px 28px;background:linear-gradient(#161616 60%,transparent)}
.top .mid{display:inline-flex;align-items:center;gap:10px;font:300 15px/1 "Austin News Deck",serif}
.top .mid svg{width:10px;height:10px;transition:transform .3s}.top .mid[aria-expanded=true] svg{transform:rotate(180deg)}
.top .r{text-align:right}
.top .back span{display:inline-block;transition:transform .25s}.top .back:hover span{transform:translateX(-4px)}
.dd{position:fixed;left:0;right:0;top:0;bottom:0;z-index:6;background:rgba(22,22,22,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:80px 28px;display:grid;grid-template-columns:repeat(3,1fr);gap:40px;align-content:start;opacity:0;visibility:hidden;transition:.3s}
.dd.on{opacity:1;visibility:visible}
.dd .g{color:rgba(255,255,255,.5);margin-bottom:8px}
.dd a{display:block;font:300 20px/1.25 "Austin News Deck",serif;padding:3px 0;color:rgba(255,255,255,.85)}.dd a:hover{color:#fff;padding-left:8px;transition:.25s}
.hero{padding:40px 28px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:end}
.hero h1{font:300 clamp(36px,5.5vw,84px)/1 "Austin News Deck",serif;max-width:12em}
.hero .m{color:rgba(255,255,255,.6);max-width:48ch}
.strip{margin-top:40px;overflow-x:auto;scrollbar-width:none;cursor:grab;display:flex;gap:16px;padding:0 28px;scroll-snap-type:x proximity;scroll-padding-left:28px}
.strip::-webkit-scrollbar{display:none}
.strip.drag{cursor:grabbing;scroll-snap-type:none}
.strip figure{flex:none;height:62vh;scroll-snap-align:start;position:relative}
.strip img{height:100%;width:auto;user-select:none;-webkit-user-drag:none}
.strip figcaption{position:absolute;left:12px;bottom:10px;color:#fff;mix-blend-mode:difference;font-variant-numeric:tabular-nums}
.rail{margin:34px 28px 0;height:1px;background:rgba(255,255,255,.15);position:relative}
.rail i{position:absolute;left:0;top:-1px;height:3px;width:10%;background:#fff;transition:left .1s linear}
.body{padding:48px 28px 80px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px}
.body .prose{font:300 16px/1.5 "Austin News Deck",serif;max-width:34em}
.body dl{display:grid;grid-template-columns:7em 1fr;gap:4px 12px;color:rgba(255,255,255,.55);align-content:start}
.body dd{color:#fff}
.pn{grid-column:1/-1;display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.2);padding-top:14px;color:rgba(255,255,255,.6)}
.cursor{position:fixed;z-index:60;left:0;top:0;width:52px;height:52px;border-radius:50%;background:#fff;color:#000;display:grid;place-items:center;font-size:14px;pointer-events:none;opacity:0;transform:translate(-50%,-50%) scale(.6);transition:opacity .2s,transform .2s;mix-blend-mode:difference}
.cursor.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
@media(max-width:800px){.side{display:none}.hero,.body{grid-template-columns:1fr}.dd{grid-template-columns:1fr}.intro{display:none}}
`;
	// deterministic scatter
	let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
	const field = works.map((w, i) => {
		const x = 30 + rnd() * 62, y = 6 + rnd() * 78, wpx = 11 + rnd() * 9, z = (0.4 + rnd() * 1.2).toFixed(2);
		return `<a href="o9-project.html" data-i="${i}" style="--x:${x.toFixed(1)}vw;--y:${y.toFixed(1)}vh;--w:${wpx.toFixed(1)}vw;--z:${z}"><img src="${w.cover.src}" alt="" loading="${i < 10 ? 'eager' : 'lazy'}"><span class="l">${w.title}, ${w.year}</span></a>`;
	}).join('');
	const side = nav.groups.map(g => `<p class="g">${g.label}</p>${works.filter(x => x.category === g.label).map(w => `<a href="o9-project.html" data-i="${works.indexOf(w)}">${w.title}<small>${w.year}</small></a>`).join('')}`).join('');
	const HOME_JS = `
var f=document.getElementById('field'),tiles=[].slice.call(f.children),side=[].slice.call(document.querySelectorAll('.side a'));
var px=0,py=0,tx=0,ty=0;
addEventListener('mousemove',function(e){tx=(e.clientX/innerWidth-.5)*-40;ty=(e.clientY/innerHeight-.5)*-30});
(function loop(){px+=(tx-px)*.06;py+=(ty-py)*.06;f.style.setProperty('--px',px+'px');f.style.setProperty('--py',py+'px');requestAnimationFrame(loop)})();
function focus(i){f.classList.toggle('focus',i>=0);tiles.forEach(function(t){t.classList.toggle('on',+t.dataset.i===i)});side.forEach(function(a){a.classList.toggle('on',+a.dataset.i===i)})}
side.forEach(function(a){a.addEventListener('mouseenter',function(){focus(+a.dataset.i)});a.addEventListener('mouseleave',function(){focus(-1)})});
tiles.forEach(function(t){t.addEventListener('mouseenter',function(){side.forEach(function(a){a.classList.toggle('on',a.dataset.i===t.dataset.i)})});t.addEventListener('mouseleave',function(){side.forEach(function(a){a.classList.remove('on')})})});
/* FLIP into the project page */
function go(e,el){e.preventDefault();var img=el.querySelector('img'),r=img?img.getBoundingClientRect():null,d=document.createElement('div');d.className='flip';if(r){d.style.cssText='left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';d.innerHTML='<img src="'+img.src+'" alt="">'}else{d.style.cssText='left:50%;top:50%;width:0;height:0'}document.body.appendChild(d);d.animate([{},{left:'28px',top:'60px',width:(innerWidth-56)+'px',height:'62vh'}],{duration:650,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'}).onfinish=function(){location.href=el.getAttribute('href')}}
tiles.forEach(function(t){t.addEventListener('click',function(e){go(e,t)})});
side.forEach(function(a){a.addEventListener('click',function(e){var t=tiles[+a.dataset.i];go(e,t)})});
window.addEventListener('load',function(){if(window.MLBackdrops)MLBackdrops.init(document)});
`;
	out['o9-home'] = shell('Matthew Lau', css, `${slitHTML()}<header><a href="o9-home.html">Matthew Lau</a><nav><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></nav></header><div class="field" id="field">${field}</div><nav class="side">${side}</nav><div class="intro prose">${introHTML}</div><p class="hint">Hover a title, or wander.</p>`, HOME_JS, true);
	const w = feature;
	const ddHTML = nav.groups.map(g => `<section><p class="g">${g.label}</p>${works.filter(x => x.category === g.label).map(x => `<a href="o9-project.html">${x.title}</a>`).join('')}</section>`).join('');
	const PJ_JS = `
document.body.classList.add('pj');
var mid=document.getElementById('mid'),dd=document.getElementById('dd');
mid.onclick=function(){var o=dd.classList.toggle('on');mid.setAttribute('aria-expanded',o)};
document.addEventListener('keydown',function(e){if(e.key==='Escape'){dd.classList.remove('on');mid.setAttribute('aria-expanded',false)}});
/* drag strip + rail + cursor */
var s=document.getElementById('strip'),rail=document.getElementById('rail'),cur=document.getElementById('cursor'),down=false,sx=0,sl=0,moved=0;
s.addEventListener('pointerdown',function(e){down=true;moved=0;sx=e.clientX;sl=s.scrollLeft;s.classList.add('drag');s.setPointerCapture(e.pointerId)});
s.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx;moved+=Math.abs(dx);s.scrollLeft=sl-dx});
s.addEventListener('pointerup',function(){down=false;s.classList.remove('drag')});
s.addEventListener('scroll',function(){var k=s.scrollLeft/(s.scrollWidth-s.clientWidth||1);rail.style.left=(k*90)+'%'},{passive:true});
s.addEventListener('wheel',function(e){if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){s.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
s.addEventListener('mouseenter',function(){cur.classList.add('on')});s.addEventListener('mouseleave',function(){cur.classList.remove('on')});
addEventListener('mousemove',function(e){cur.style.transform='translate('+e.clientX+'px,'+e.clientY+'px) translate(-50%,-50%) scale('+(cur.classList.contains('on')?1:.6)+')';if(s.contains(e.target)){var b=s.getBoundingClientRect();cur.textContent=e.clientX<b.left+b.width/2?'←':'→'}});
s.addEventListener('click',function(e){if(moved>6)return;var b=s.getBoundingClientRect();s.scrollBy({left:(e.clientX<b.left+b.width/2?-1:1)*s.clientWidth*.6,behavior:'smooth'})});
`;
	out['o9-project'] = shell(w.title, css, `<div class="top"><a class="back" href="o9-home.html"><span>←</span> Matthew Lau</a><button class="mid" id="mid" aria-expanded="false" aria-controls="dd">${w.title} <svg viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M1 3l4 4 4-4"/></svg></button><div class="r"><a href="About.html">About</a> &nbsp;&nbsp; <a href="mailto:matt@matthewlaujh.com">Email</a></div></div>
<div class="dd" id="dd">${ddHTML}</div>
<section class="hero"><h1>${w.title}</h1><p class="m">${w.year} — ${w.category}. ${fix(w.context, 'o9')}</p></section>
<div class="strip" id="strip">${w.images.map((im, i) => `<figure><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" draggable="false" loading="${i < 3 ? 'eager' : 'lazy'}"><figcaption>${i + 1} / ${w.images.length}</figcaption></figure>`).join('')}</div><div class="rail" id="rail"><i></i></div>
<div class="body"><div class="prose">${fix(w.body, 'o9')}</div><dl><dt>Year</dt><dd>${w.year}</dd><dt>Category</dt><dd>${w.category}</dd><dt>Context</dt><dd>${fix(w.context, 'o9')}</dd><dt>Images</dt><dd>${w.images.length}</dd></dl><nav class="pn"><a href="o9-home.html">← All work</a><a href="o9-project.html">Next: ${next.title} →</a></nav></div>
<div class="cursor" id="cursor">→</div>`, PJ_JS);
}

/* ------------------------------------------------------------------ hub */
const hubCss = `body{background:#fff;color:#111;font:300 14px/1.5 "Atlas Grotesk",sans-serif;padding:40px;max-width:64rem}h1{font:300 28px/1.2 "Austin News Deck",serif;margin-bottom:24px}h2{font:300 13px/1.4 "Atlas Grotesk",sans-serif;color:#888;margin:40px 0 8px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px 16px 10px 0;border-bottom:1px solid #ddd;vertical-align:top}th{font-weight:300;color:#888}td b{font-weight:300;font-family:"Austin News Deck",serif;font-size:18px}a{text-decoration:underline;text-underline-offset:3px}p{color:#666;margin-top:24px;max-width:60ch}`;
const r1 = [
	['o1', 'Index', 'Downtown studio. One grotesk, one table of works; hover a row to see it.'],
	['o2', 'Wall label', 'Museum catalogue: plate grid, sticky label column, figure numbers.'],
	['o3', 'Lightbox', 'Black room, one image at a time; the index is an overlay.'],
	['o4', 'Monograph', 'Slow single column, serif, one plate per work, essay-style project page.'],
	['o5', 'Grid', 'Swiss boutique: strict 3-up square grid with category filters.'],
	['o6', 'Typographic', 'Static stand-in for the slit-scan. Titles set large; cover image follows the cursor.']
];
const r2 = [
	['o7', 'Ledger', 'From O1. Rows stagger in, filters count down, hover scrubs through the project’s images, click expands the row in place. Project page: sticky bar with ← and the title as a dropdown of the whole table; plates wipe in; progress line.'],
	['o8', 'Marquee', 'From O6, on the real slit-scan. Letters italicise in a wave on hover, the cover trails the cursor and tilts with velocity, the backdrop speeds up while you hover. Project page: title rises letter by letter, images unzoom as they enter, title bar appears on scroll.'],
	['o9', 'Field', 'Covers scattered as a drifting field with mouse parallax; the title list on the left pulls one forward and dims the rest; clicking expands the cover into the project page. Project page: drag-scroll strip with a ←/→ cursor and a rail, title dropdown.']
];
const tbl = rows => `<table><tr><th></th><th>Direction</th><th>Idea</th><th>Home</th><th>Project</th></tr>${rows.map(o => `<tr><td>${o[0].toUpperCase()}</td><td><b>${o[1]}</b></td><td>${o[2]}</td><td><a href="${o[0]}-home.html">home</a></td><td><a href="${o[0]}-project.html">project</a></td></tr>`).join('')}</table>`;
out['options'] = shell('Directions', hubCss, `<h1>Directions for matthewlaujh.com</h1><h2>Round 2 — grown from O1 and O6</h2>${tbl(r2)}<h2>Round 1</h2>${tbl(r1)}<p>All run on the real content and images; the project page is always Ambi(latent) Space. Only the home and one project page are built per direction.</p>`);

for (const [name, html] of Object.entries(out)) fs.writeFileSync(path.join(OUT, name + '.html'), html);
console.log(Object.keys(out).length + ' pages written');
