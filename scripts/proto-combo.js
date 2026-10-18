#!/usr/bin/env node
/*
 * Round 3 — the combination: Marquee home (smaller titles) + Ledger's title
 * dropdown on project pages + project page that lands on a slit-scan of its
 * own hero image + the Field as a separate "all projects" page.
 *   node scripts/proto-combo.js -> preview/o10-home.html, o10-project.html, o10-field.html
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
const HOME_SLIT = JSON.stringify({ settings: home.backdrop.settings, image: Object.assign({}, home.backdrop.image, { src: home.backdrop.image.src.replace(/^\//, '') }) });

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
	return { slug: p.slug, title, year, category: g.label, context, body: rest, images, cover: images[0] };
}));
const feature = works.find(w => w.slug === 'Ambi-latent-Space-2025');
const next = works[(works.indexOf(feature) + 1) % works.length];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fix = (html, v) => html.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, href, post, inner) => {
	if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(href)) return bySlug[href] ? `<a href="${v}-project.html">${inner}</a>` : inner;
	return `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;
});

/* slit-scan of an arbitrary image: same settings as the home backdrop, a
   little calmer (fewer cycles) so the photograph stays legible */
const slitOf = (img, calm) => `<div class="backdrop" data-backdrop="slitscan" aria-hidden="true"><script type="application/json">${JSON.stringify({ settings: Object.assign({}, home.backdrop.settings, calm ? { scan_cycles: 3, wiggle: 6, target_speed: 30, flip_y: true } : {}), image: { src: img.src, width: img.w, height: img.h } })}</script></div><div class="veil" aria-hidden="true" style="background:rgba(0,0,0,${calm ? '.22' : '.38'})"></div>`;

const BASE_CSS = `
@font-face{font-family:"Austin News Deck";font-weight:300;font-style:normal;src:url(fonts/AustinNewsDeck-Light.otf) format("opentype")}
@font-face{font-family:"Austin News Deck";font-weight:300;font-style:italic;src:url(fonts/AustinNewsDeck-LightItalic.otf) format("opentype")}
@font-face{font-family:"Atlas Grotesk";font-weight:300;font-style:normal;src:url(fonts/AtlasGrotesk-Light.otf) format("opentype")}
@font-face{font-family:"Atlas Grotesk";font-weight:300;font-style:italic;src:url(fonts/AtlasGrotesk-LightItalic.otf) format("opentype")}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:none}
body{margin:0;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;background:#111;color:#fff;font:300 13px/1.4 "Atlas Grotesk",Helvetica,Arial,sans-serif}
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
.prose a{text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(255,255,255,.4)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.backdrop{position:fixed;inset:0;z-index:0;overflow:hidden;opacity:0;transition:opacity 1s}
.backdrop.loaded{opacity:1}
.backdrop canvas{position:absolute;inset:0;width:100%;height:100%;background:#000}
.veil{position:fixed;inset:0;z-index:0;background:rgba(0,0,0,.38);pointer-events:none}
/* ---- shared top bar: ← name | title ▾ | About Email */
.top{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:16px 28px 22px;background:linear-gradient(rgba(17,17,17,.92),rgba(17,17,17,0))}
.top .l a span{display:inline-block;transition:transform .25s}.top .l a:hover span{transform:translateX(-4px)}
.top .r{text-align:right;display:flex;gap:18px;justify-content:flex-end}
.top .r a{position:relative}
.top .r a::after{content:"";position:absolute;left:0;right:100%;bottom:-3px;height:1px;background:#fff;transition:right .25s cubic-bezier(.3,0,.2,1)}
.top .r a:hover::after,.top .r a[aria-current]::after{right:0}
.top .mid{display:inline-flex;align-items:center;gap:10px;font:300 15px/1 "Austin News Deck",serif;opacity:0;transform:translateY(6px);transition:.3s;pointer-events:none}
.top .mid.show{opacity:1;transform:none;pointer-events:auto}
.top .mid b{font:300 11px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.55)}
.top .mid svg{width:10px;height:10px;transition:transform .3s}.top .mid[aria-expanded=true] svg{transform:rotate(180deg)}
.dd{position:fixed;left:0;right:0;top:0;z-index:19;background:rgba(17,17,17,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.25);padding:84px 28px 32px;display:grid;grid-template-columns:repeat(3,1fr);gap:32px;transform:translateY(-10px);opacity:0;visibility:hidden;transition:.3s cubic-bezier(.3,0,.2,1)}
.dd.on{transform:none;opacity:1;visibility:visible}
.dd h3{font-weight:300;color:rgba(255,255,255,.5);margin:0 0 8px}
.dd a{display:block;padding:3px 0;font:300 17px/1.3 "Austin News Deck",serif;color:rgba(255,255,255,.85);transition:padding-left .2s,color .2s}
.dd a small{font:300 11px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.5);margin-left:.6em}
.dd a:hover{padding-left:8px;color:#fff}
.dd a[aria-current]{color:#fff;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,255,255,.5)}
.dd .foot{grid-column:1/-1;display:flex;justify-content:space-between;color:rgba(255,255,255,.5);border-top:1px solid rgba(255,255,255,.15);padding-top:14px;margin-top:8px}
.dd .foot a{font:inherit;display:inline;padding:0}
.scrim{position:fixed;inset:0;z-index:18;opacity:0;visibility:hidden;transition:.3s}
.scrim.on{opacity:1;visibility:visible}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media(max-width:800px){.dd{grid-template-columns:1fr;gap:20px;overflow:auto;bottom:0}}
`;
const shell = (title, css, body, js) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}${css}</style><script src="js/backdrops.js" defer></script></head><body>${body}<script>window.addEventListener('load',function(){if(window.MLBackdrops)MLBackdrops.init(document)});${js || ''}</script></body></html>`;

const V = 'o10';
const ddHTML = (cur) => `<div class="scrim" id="scrim"></div><div class="dd" id="dd">${nav.groups.map(g => `<section><h3>${g.label}</h3>${works.filter(x => x.category === g.label).map(x => `<a href="${V}-project.html"${x === cur ? ' aria-current="page"' : ''}>${x.title}<small>${x.year}</small></a>`).join('')}</section>`).join('')}<div class="foot"><a href="${V}-field.html">See all projects in space →</a><a href="${V}-home.html">Home</a></div></div>`;
const DD_JS = `
var mid=document.getElementById('mid'),dd=document.getElementById('dd'),sc=document.getElementById('scrim');
function tog(o){o=o===undefined?!dd.classList.contains('on'):o;dd.classList.toggle('on',o);sc.classList.toggle('on',o);mid.setAttribute('aria-expanded',o);if(o)mid.classList.add('show')}
mid.onclick=function(){tog()};sc.onclick=function(){tog(false)};document.addEventListener('keydown',function(e){if(e.key==='Escape')tog(false)});
`;
const topHTML = (left, midTitle, midYear, cur) => `<div class="top"><div class="l">${left}</div><button class="mid${midTitle ? '' : ' show'}" id="mid" aria-expanded="false" aria-controls="dd">${midTitle || 'Projects'}${midYear ? ` <b>${midYear}</b>` : ''} <svg viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M1 3l4 4 4-4"/></svg></button><div class="r"><a href="${V}-field.html"${cur === 'field' ? ' aria-current="page"' : ''}>All projects</a><a href="About.html">About</a><a href="mailto:matt@matthewlaujh.com">Email</a></div></div>${ddHTML(cur)}`;

const out = {};

/* --------------------------------------------------------------- HOME */
{
	const css = `
body{overflow-x:hidden}
.wrap{position:relative;z-index:1;padding:0 28px 40px;display:grid;grid-template-columns:3fr 1fr;gap:48px;align-items:start}
.list{margin-top:4vh;min-width:0}
.list .g{color:rgba(255,255,255,.55);margin:28px 0 4px;display:flex;align-items:center;gap:12px}
.list .g::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.18)}
.list a{display:block;width:fit-content;max-width:100%;font:300 clamp(18px,1.9vw,27px)/1.2 "Austin News Deck",Georgia,serif;padding:.08em 0;color:rgba(255,255,255,.9);transition:color .3s,padding-left .4s cubic-bezier(.2,.6,.2,1)}
.list a span.w{white-space:nowrap;display:inline-block}
.list a .ch{display:inline-block;transition:transform .25s;transition-delay:var(--d)}
.list a:hover .ch{font-style:italic;transform:translateY(-.03em)}
.list:has(a:hover) a:not(:hover){color:rgba(255,255,255,.32)}
.list a:hover{padding-left:.4em}
.list a small{font:300 11px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.55);vertical-align:top;margin-left:.6em;display:inline-block;padding-top:.45em}
.cur{position:fixed;left:0;top:0;z-index:3;width:22vw;pointer-events:none;opacity:0;transition:opacity .25s;will-change:transform}
.cur.on{opacity:1}
.cur img{width:100%;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.cur .cap{position:absolute;left:0;right:0;bottom:-20px;display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.6)}
.aside{position:sticky;top:70px;margin-top:4vh;padding-top:30px}
.intro{font:300 15px/1.45 "Austin News Deck",serif;color:rgba(255,255,255,.85)}
.aside .meta{margin-top:28px;color:rgba(255,255,255,.55);display:grid;gap:4px}
.aside .meta a:hover{color:#fff}
.intro p+p{margin-top:.5em}
.intro .more{display:inline-block;margin-top:1em;font:300 12px/1 "Atlas Grotesk",sans-serif;border-bottom:1px solid rgba(255,255,255,.4);padding-bottom:3px}
@media(max-width:800px){.cur{display:none}.list a:hover{padding-left:0}.wrap{grid-template-columns:1fr}.aside{position:static;padding-top:0}}
`;
	const split = t => t.split(' ').map(word => `<span class="w">${[...word].map((c, k) => `<span class="ch" style="--d:${k * 18}ms">${c}</span>`).join('')}</span>`).join(' ');
	const list = nav.groups.map(g => `<p class="g">${g.label}</p>${works.filter(x => x.category === g.label).map(w => `<a href="${V}-project.html" data-img="${w.cover.src}" data-t="${esc(w.title)}" data-y="${w.year}">${split(w.title)}<small>${w.year}</small></a>`).join('')}`).join('');
	const js = `
var c=document.getElementById('cur'),im=c.querySelector('img'),cap=c.querySelector('.cap'),mx=innerWidth/2,my=innerHeight/2,x=mx,y=my,vx=0,vy=0;
addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY});
(function loop(){var nx=x+(mx-x)*.12,ny=y+(my-y)*.12;vx=nx-x;vy=ny-y;x=nx;y=ny;var w=c.offsetWidth,h=c.offsetHeight;var px=Math.min(x+24,innerWidth-w-24),py=Math.min(y+24,innerHeight-h-40);c.style.transform='translate('+px+'px,'+py+'px) rotate('+Math.max(-6,Math.min(6,vx*.25))+'deg) skewY('+Math.max(-4,Math.min(4,vy*.15))+'deg)';requestAnimationFrame(loop)})();
function bd(s){var el=document.querySelector('.backdrop');if(el&&el.__instance&&el.__instance.data)el.__instance.data.speedScale=s}
document.querySelectorAll('.list a').forEach(function(a){a.addEventListener('mouseenter',function(){im.src=a.dataset.img;cap.innerHTML='<span>'+a.dataset.t+'</span><span>'+a.dataset.y+'</span>';c.classList.add('on');bd(2.2)});a.addEventListener('mouseleave',function(){c.classList.remove('on');bd(1)})});
${DD_JS}`;
	out[V + '-home'] = shell('Matthew Lau', css, `<div class="backdrop" data-backdrop="slitscan" aria-hidden="true"><script type="application/json">${HOME_SLIT}</script></div><div class="veil" aria-hidden="true"></div>
${topHTML('<a href="' + V + '-home.html">Matthew Lau</a>', '', '', 'home')}
<div class="wrap"><div class="list">${list}</div><aside class="aside"><div class="intro prose">${introHTML}<a class="more" href="About.html">More about me</a></div><div class="meta"><a href="mailto:matt@matthewlaujh.com">matt@matthewlaujh.com</a><span>Singapore</span></div></aside></div>
<div class="cur" id="cur"><img alt=""><div class="cap"></div></div>`, js);
}

/* ------------------------------------------------------------ PROJECT */
{
	const w = feature;
	/* fields the Cargo data doesn't have — hand-filled for the prototype; the
	   real build would read them from each page JSON */
	const META = { line: 'A lighting fixture that turns images into light through machine learning.', tech: 'Machine learning (UMAP), colour-palette extraction, custom LED fixture', clientLabel: 'School', client: 'NYU ITP' };
	const css = `
.hero{height:100vh;position:relative;z-index:1;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;padding:0 28px 48px;margin-top:-62px}
.hero h1{font:300 clamp(44px,8.5vw,128px)/.95 "Austin News Deck",serif;letter-spacing:-.01em;max-width:11em}
.hero h1 .ch{display:inline-block;opacity:0;transform:translateY(.4em) rotate(2deg);animation:rise .9s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:var(--d)}
.hero h1 .w{white-space:nowrap;display:inline-block}
.hero h1 small{font:300 12px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.6);vertical-align:top;margin-left:.5em;display:inline-block;padding-top:.5em;opacity:0;animation:rise .9s .5s forwards}
.hero .m{margin-top:22px;font:300 clamp(17px,1.6vw,22px)/1.35 "Austin News Deck",serif;color:rgba(255,255,255,.85);max-width:36em;opacity:0;animation:rise .9s .6s forwards}
.hero .m2{margin-top:14px;display:flex;gap:24px;color:rgba(255,255,255,.6);opacity:0;animation:rise .9s .75s forwards}
.hero .m a{text-decoration:underline;text-underline-offset:3px}
.hero .dn{position:absolute;right:28px;bottom:48px;color:rgba(255,255,255,.55);opacity:0;animation:rise .9s 1s forwards}
.hero .dn i{display:inline-block;font-style:normal;animation:bob 1.8s ease-in-out infinite;margin-left:6px}
@keyframes rise{to{opacity:1;transform:none}}
@keyframes bob{50%{transform:translateY(4px)}}
html{background:#000}
body{background:#000}
.top{background:none;mix-blend-mode:difference}
.top .mid b{color:rgba(255,255,255,.7)}
.body{position:relative;z-index:1;background:#fff;color:#141414;padding:60px 28px 80px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:48px;align-items:start}
.body .txt{position:sticky;top:70px}
.body .prose{font:300 16px/1.5 "Austin News Deck",serif;max-width:34em}
.body dl{display:grid;grid-template-columns:7em 1fr;gap:4px 12px;color:#8a8a8a;border-top:1px solid #141414;padding-top:10px;margin-bottom:24px}
.body dd{color:#141414}
.body .prose a{text-decoration-color:rgba(0,0,0,.35)}
.body .ims figure{margin-bottom:28px;position:relative;overflow:hidden}
.body .ims img{width:100%;transform:scale(1.06);transition:transform 1.4s cubic-bezier(.2,.6,.2,1)}
.body .ims figure.seen img{transform:none}
.body .ims figcaption{position:absolute;left:12px;bottom:10px;font-size:11px;color:#fff;mix-blend-mode:difference}
.pn{grid-column:1/-1;display:flex;justify-content:space-between;border-top:1px solid #141414;padding-top:14px;color:#8a8a8a}
.pn a:hover{color:#141414}
.pn a span{display:inline-block;transition:transform .25s}.pn a:hover span{transform:translateX(4px)}
@media(max-width:800px){.body{grid-template-columns:1fr}.body .txt{position:static}}
`;
	const split = t => t.split(' ').map((word, wi) => `<span class="w">${[...word].map((c, k) => `<span class="ch" style="--d:${(wi * 6 + k) * 22}ms">${c}</span>`).join('')}</span>`).join(' ');
	const js = `
/* randomise the slit-scan within a calm range on every load */
(function(){var sc=document.querySelector('.backdrop script'),cfg=JSON.parse(sc.textContent),r=function(a,b){return a+Math.random()*(b-a)};
cfg.settings.orientation=Math.random()<.65?'vertical':'horizontal';
cfg.settings.scan_cycles=Math.round(r(2,5));cfg.settings.scan_cycles_large=1;cfg.settings.scan_size=Math.round(r(70,100));cfg.settings.wiggle=Math.round(r(4,10));cfg.settings.target_speed=Math.round(r(18,40));
sc.textContent=JSON.stringify(cfg)})();
${DD_JS}
mid.classList.add('show');
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}})},{rootMargin:'0px 0px -15% 0px'});
document.querySelectorAll('.ims figure').forEach(function(f){io.observe(f)});
/* the slit-scan calms down as the body covers it */
addEventListener('scroll',function(){var el=document.querySelector('.backdrop');if(el&&el.__instance&&el.__instance.data)el.__instance.data.speedScale=Math.max(.2,1-scrollY/innerHeight)},{passive:true});
`;
	out[V + '-project'] = shell(w.title, css, `${slitOf(w.cover, true)}
${topHTML('<a href="' + V + '-home.html"><span>←</span> Matthew Lau</a>', w.title, w.year, w)}
<section class="hero"><h1>${split(w.title)}<small>${w.year}</small></h1><p class="m">${esc(META.line)}</p><p class="m2"><span>${w.category}</span><span>${META.client}</span></p><p class="dn">Scroll<i>↓</i></p></section>
<div class="body"><div class="txt"><dl><dt>Year</dt><dd>${w.year}</dd><dt>Category</dt><dd>${w.category}</dd><dt>Techniques</dt><dd>${META.tech}</dd><dt>${META.clientLabel}</dt><dd>${META.client}</dd></dl><div class="prose">${fix(w.body, V)}</div></div><div class="ims">${w.images.map((im, i) => `<figure><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="${i ? 'lazy' : 'eager'}"><figcaption>${i + 1} / ${w.images.length}</figcaption></figure>`).join('')}</div><nav class="pn"><a href="${V}-home.html">← Home</a><a href="${V}-project.html">Next: ${next.title} <span>→</span></a></nav></div>`, js);
}

/* -------------------------------------------------------------- FIELD */
{
	const css = `
body{height:100vh;overflow:hidden;cursor:default}
.field{position:absolute;inset:0;z-index:1;overflow:hidden}
.field a{position:absolute;width:var(--w);transform:translate(var(--x),var(--y)) translate(calc(var(--px)*var(--z)),calc(var(--py)*var(--z)));transition:filter .5s,opacity .5s;will-change:transform}
.field a img{width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.field a .l{position:absolute;left:0;top:100%;margin-top:8px;white-space:nowrap;opacity:0;transform:translateY(-4px);transition:.25s}
.field.focus a{filter:brightness(.25) blur(2px)}
.field.focus a.on{filter:none;z-index:3;opacity:1}
.field a.on .l{opacity:1;transform:none}
.field a:hover{filter:none;z-index:4}
.field a:hover .l{opacity:1;transform:none}
.side{position:fixed;left:28px;top:50%;transform:translateY(-50%);z-index:5;width:min(34vw,420px)}
.side .g{color:rgba(255,255,255,.5);margin:14px 0 2px}
.side a{display:block;font:300 15px/1.3 "Austin News Deck",serif;padding:1px 0;color:rgba(255,255,255,.85);transition:color .2s,padding-left .3s cubic-bezier(.2,.6,.2,1)}
.side a:hover,.side a.on{color:#fff;padding-left:12px}
.side a small{font:300 11px/1 "Atlas Grotesk",sans-serif;color:rgba(255,255,255,.5);margin-left:.6em}
.hint{position:fixed;left:28px;bottom:28px;z-index:5;color:rgba(255,255,255,.45)}
.cnt{position:fixed;right:28px;bottom:28px;z-index:5;color:rgba(255,255,255,.45);font-variant-numeric:tabular-nums}
.flip{position:fixed;z-index:50;pointer-events:none;background:#000}
.flip img{width:100%;height:100%;object-fit:cover}
.top{position:fixed;left:0;right:0}
@media(max-width:800px){.side{display:none}body{overflow:auto;height:auto}.field{position:relative;height:auto;padding:80px 28px 40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.field a{position:static;transform:none;width:auto}}
`;
	let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
	const field = works.map((w, i) => {
		const x = 30 + rnd() * 62, y = 8 + rnd() * 76, wpx = 11 + rnd() * 9, z = (0.4 + rnd() * 1.2).toFixed(2);
		return `<a href="${V}-project.html" data-i="${i}" style="--x:${x.toFixed(1)}vw;--y:${y.toFixed(1)}vh;--w:${wpx.toFixed(1)}vw;--z:${z}"><img src="${w.cover.src}" alt="" loading="${i < 10 ? 'eager' : 'lazy'}"><span class="l">${w.title}, ${w.year}</span></a>`;
	}).join('');
	const side = nav.groups.map(g => `<p class="g">${g.label}</p>${works.filter(x => x.category === g.label).map(w => `<a href="${V}-project.html" data-i="${works.indexOf(w)}">${w.title}<small>${w.year}</small></a>`).join('')}`).join('');
	const js = `
${DD_JS}
var f=document.getElementById('field'),tiles=[].slice.call(f.children),side=[].slice.call(document.querySelectorAll('.side a'));
var px=0,py=0,tx=0,ty=0;
addEventListener('mousemove',function(e){tx=(e.clientX/innerWidth-.5)*-40;ty=(e.clientY/innerHeight-.5)*-30});
(function loop(){px+=(tx-px)*.06;py+=(ty-py)*.06;f.style.setProperty('--px',px+'px');f.style.setProperty('--py',py+'px');requestAnimationFrame(loop)})();
function focus(i){f.classList.toggle('focus',i>=0);tiles.forEach(function(t){t.classList.toggle('on',+t.dataset.i===i)});side.forEach(function(a){a.classList.toggle('on',+a.dataset.i===i)})}
side.forEach(function(a){a.addEventListener('mouseenter',function(){focus(+a.dataset.i)});a.addEventListener('mouseleave',function(){focus(-1)})});
tiles.forEach(function(t){t.addEventListener('mouseenter',function(){side.forEach(function(a){a.classList.toggle('on',a.dataset.i===t.dataset.i)})});t.addEventListener('mouseleave',function(){side.forEach(function(a){a.classList.remove('on')})})});
function go(e,el){e.preventDefault();var img=el.querySelector('img'),r=img.getBoundingClientRect(),d=document.createElement('div');d.className='flip';d.style.cssText='left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';d.innerHTML='<img src="'+img.src+'" alt="">';document.body.appendChild(d);d.animate([{},{left:'0px',top:'0px',width:innerWidth+'px',height:innerHeight+'px'}],{duration:700,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'}).onfinish=function(){location.href=el.getAttribute('href')}}
tiles.forEach(function(t){t.addEventListener('click',function(e){go(e,t)})});
side.forEach(function(a){a.addEventListener('click',function(e){go(e,tiles[+a.dataset.i])})});
`;
	out[V + '-field'] = shell('All projects — Matthew Lau', css, `<div class="backdrop" data-backdrop="slitscan" aria-hidden="true"><script type="application/json">${HOME_SLIT}</script></div><div class="veil" aria-hidden="true"></div>
${topHTML('<a href="' + V + '-home.html"><span>←</span> Matthew Lau</a>', 'All projects', '', 'field')}
<div class="field" id="field">${field}</div><nav class="side">${side}</nav><p class="hint">Hover a title, or wander. Click to open.</p><p class="cnt">${works.length} projects, 2020–2025</p>`, js);
}

for (const [name, html] of Object.entries(out)) fs.writeFileSync(path.join(OUT, name + '.html'), html);

/* hub: add round 3 on top */
const hub = path.join(OUT, 'options.html');
let h = fs.readFileSync(hub, 'utf8');
if (!h.includes('o10-home')) {
	h = h.replace('<h2>Round 2', `<h2>Round 3 — the combination</h2><table><tr><th></th><th>Page</th><th>What it is</th><th></th></tr><tr><td>O10</td><td><b>Home</b></td><td>Marquee with smaller titles, letter-wave hover, trailing cover, slit-scan. Top bar carries “Projects ▾” (Ledger’s dropdown, dark) + All projects / About / Email.</td><td><a href="o10-home.html">open</a></td></tr><tr><td></td><td><b>Project</b></td><td>Lands on a slit-scan of the project’s own hero image with the title rising over it; scroll down into the body. The bar’s middle becomes the project title ▾ once you scroll.</td><td><a href="o10-project.html">open</a></td></tr><tr><td></td><td><b>All projects</b></td><td>The Field as its own page: every cover in space, title list on the left, click to open.</td><td><a href="o10-field.html">open</a></td></tr></table><h2>Round 2`);
	fs.writeFileSync(hub, h);
}
console.log(Object.keys(out).length + ' pages written');
