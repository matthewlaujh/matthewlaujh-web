#!/usr/bin/env node
/*
 * Static build for matthewlaujh.com (v3 — "Marquee" layout).
 *
 *   node build.js              -> public/   (root-relative URLs, for Cloudflare Pages)
 *   node build.js --relative   -> preview/  (relative URLs, for the artifact preview)
 *
 * Pages:
 *   /               home: title list (3/4) + intro (1/4) over the slit-scan
 *   /<slug>         project: slit-scan of its own hero image, then the text + plates on white
 *   /All-Projects   every cover floating in space
 *   /About          the About page on white
 * Every page shares the top bar (← name · title ▾ dropdown) and the footer
 * (studio clock · rights line). No dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const convert = require('./src/lib/convert.js');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const RELATIVE = process.argv.includes('--relative');
const OUT = RELATIVE ? path.join(ROOT, 'preview') : path.join(ROOT, 'public');

const site = readJSON(path.join(SRC, 'site.json'));
const navPage = readJSON(path.join(SRC, 'pinned', 'nav.json'));
const infoPage = readJSON(path.join(SRC, 'pinned', 'info.json'));
const pages = fs.readdirSync(path.join(SRC, 'pages'))
	.filter(f => f.endsWith('.json'))
	.map(f => readJSON(path.join(SRC, 'pages', f)));
const bySlug = Object.fromEntries(pages.map(p => [p.slug, p]));
const home = bySlug[site.homepage];
const nav = convert.navModel(navPage.content);
const email = (infoPage.content.match(/mailto:([^"]+)/) || [])[1] || 'matt@matthewlaujh.com';
const FIELD_SLUG = 'All-Projects';
const YEAR = new Date().getFullYear();

/* ------------------------------------------------------------------ utils */
function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(from, to) {
	fs.mkdirSync(to, { recursive: true });
	for (const e of fs.readdirSync(from, { withFileTypes: true })) {
		const a = path.join(from, e.name), b = path.join(to, e.name);
		e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
	}
}
function url(slug) {
	if (!slug || slug === site.homepage) return RELATIVE ? 'index.html' : '/';
	return RELATIVE ? slug + '.html' : '/' + slug;
}
function asset(p) { return RELATIVE ? p.replace(/^\//, '') : p; }
function json(o) { return JSON.stringify(o).replace(/<\/script/gi, '<\\/script'); }

/* Cargo stored links as bare slugs; make them real URLs. Links to pages that
   don't exist are left as plain text (Cargo 404'd on them). */
function fixLinks(htmlStr, currentSlug) {
	return htmlStr.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, href, post, inner) => {
		let attrs = (pre + post).replace(/\s*rel="history"/, '').replace(/\s+/g, ' ').trim();
		if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(href)) {
			if (!bySlug[href]) return inner;
			const h = url(href);
			if (href === currentSlug && currentSlug !== site.homepage) attrs += ' aria-current="page"';
			return `<a href="${h}"${attrs ? ' ' + attrs : ''}>${inner}</a>`;
		}
		if (/^https?:\/\//.test(href) && !/rel=/.test(attrs)) attrs += ' rel="noopener"';
		return `<a href="${href}"${attrs ? ' ' + attrs : ''}>${inner}</a>`;
	});
}

/* ------------------------------------------------------------------ model */
/* the works, in nav order, with the derived fields the layout needs */
const works = nav.groups.flatMap(g => g.items.filter(i => i.href && bySlug[i.href]).map(i => {
	const p = bySlug[i.href];
	const prose = convert.prose(p.content);
	const paras = prose.split(/\n(?=<)/);
	const firstP = paras.find(x => x.startsWith('<p>')) || '';
	const context = firstP.replace(/<\/?p>/g, '');
	const body = prose.replace(firstP, '').replace(/^\s*<hr>\s*/, '').replace(/<hr>\s*$/, '');
	const title = p.title_no_html.replace(/\s*\(\d{4}(?:[–-]\d{4})?\)\s*$/, '').replace(/,\s*$/, '');
	const year = (p.title_no_html.match(/\((\d{4}(?:[–-]\d{4})?)\)/) || [])[1] || '';
	const images = p.images.map(im => Object.assign({}, im, { src: asset(im.src) }));
	return { page: p, slug: p.slug, title, year, category: g.label, context, body, images, cover: images[0], meta: p.meta || {} };
}));
const workBySlug = Object.fromEntries(works.map(w => [w.slug, w]));
const years = works.map(w => parseInt(w.year, 10)).filter(Boolean);
const yearRange = Math.min(...years) + '–' + Math.max(...years);

/* ------------------------------------------------------------- fragments */
function splitTitle(t) {
	// each letter gets its own span so the hover wave / rise can stagger
	return t.split(' ').map((word, wi) => `<span class="w">${[...word].map((c, k) => `<span class="ch" style="--d:${(wi * 6 + k) * 18}ms">${esc(c)}</span>`).join('')}</span>`).join(' ');
}

function dropdownHTML(current) {
	const groups = nav.groups.map(g => `\t\t<section>\n\t\t\t<h3>${g.label}</h3>\n${g.items.map(it => {
		if (it.href && workBySlug[it.href]) {
			const w = workBySlug[it.href];
			return `\t\t\t<a href="${url(w.slug)}"${w.slug === current ? ' aria-current="page"' : ''}>${esc(w.title)}<small>${w.year}</small></a>`;
		}
		return `\t\t\t<span class="dead" title="Coming soon">${it.text}</span>`;
	}).join('\n')}\n\t\t</section>`).join('\n');
	return `<div class="scrim" id="scrim"></div>
	<div class="dropdown" id="dropdown" aria-label="Projects">
${groups}
		<div class="foot">
			<a href="${url(FIELD_SLUG)}"${current === FIELD_SLUG ? ' aria-current="page"' : ''}>All projects in space →</a>
			<span><a href="${url('About')}"${current === 'About' ? ' aria-current="page"' : ''}>About</a> &nbsp;&nbsp; <a href="mailto:${email}">Email</a> &nbsp;&nbsp; <a href="${url(site.homepage)}">Home</a></span>
		</div>
	</div>`;
}

function barHTML(page) {
	const isHome = page.slug === site.homepage;
	const w = workBySlug[page.slug];
	let mid = 'Projects', midYear = '';
	if (w) { mid = esc(w.title); midYear = w.year; }
	else if (page.slug === FIELD_SLUG) mid = 'All projects';
	else if (page.slug === 'About') mid = 'About';
	const left = isHome
		? `<a class="site-title" href="${url(site.homepage)}">${nav.title}</a>`
		: `<a class="site-title back" href="${url(site.homepage)}" aria-label="Home"><span>←</span> <i class="nm">${nav.title}</i></a>`;
	return `<header class="bar">
		<div class="bar-left">${left}</div>
		${isHome ? '<span></span>' : `<button class="bar-title" id="bar_title" type="button" aria-expanded="false" aria-controls="dropdown">${mid}${midYear ? ` <b>${midYear}</b>` : ''} <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" aria-hidden="true"><path d="M1 3l4 4 4-4"/></svg></button>`}
		<div class="bar-right"></div>
	</header>
	${isHome ? '' : dropdownHTML(page.slug)}`;
}

function footerHTML() {
	return `<footer class="site-footer">
		<span class="studio-clock" aria-live="off"><span class="dot" aria-hidden="true"></span><span class="clock-text">Studio · Singapore</span></span>
		<span class="rights">© ${YEAR} Matthew Lau. All rights reserved.</span>
	</footer>`;
}

function slitHTML(image, opts) {
	const settings = Object.assign({}, home.backdrop.settings, opts && opts.settings || {});
	const cfg = { settings, image: { src: asset(image.src), width: image.width, height: image.height } };
	return `<div class="backdrop" data-backdrop="slitscan"${opts && opts.random ? ' data-random' : ''} aria-hidden="true"><script type="application/json">${json(cfg)}</script></div><div class="veil${opts && opts.light ? ' veil--light' : ''}" aria-hidden="true"></div>`;
}

function introHTML(currentSlug) {
	const cols = convert.textColumn(home.content);
	const intro = cols[cols.length - 1];
	const html = convert.blocks(intro.html)
		.replace(/<p><a[^>]*>Click here for more about me\.<\/a><\/p>/, '')
		.replace(/<hr>\s*$/, '');
	return `<div class="prose">\n${fixLinks(html, currentSlug)}\n</div>`;
}

/* ------------------------------------------------------------------ pages */
function homeMain() {
	const list = nav.groups.map(g => `\t\t\t<p class="group">${g.label}</p>\n${g.items.map(it => {
		if (it.href && workBySlug[it.href]) {
			const w = workBySlug[it.href];
			return `\t\t\t<a href="${url(w.slug)}" data-img="${w.cover.src}" data-title="${esc(w.title)}" data-year="${w.year}">${splitTitle(w.title)}<small>${w.year}</small></a>`;
		}
		return `\t\t\t<span class="dead" title="Coming soon">${splitTitle(it.text.replace(/\s*\(.*\)$/, ''))}<small>${(it.text.match(/\((.*)\)/) || [])[1] || ''}</small></span>`;
	}).join('\n')}`).join('\n');
	return `<main class="home">
		<h1 class="visually-hidden">${esc(site.title)}</h1>
		<nav class="marquee" aria-label="Projects">
${list}
		</nav>
		<aside class="home-aside">
			${introHTML(site.homepage)}
			<a class="more" href="${url('About')}">More about me</a>
			<p class="contact"><a href="mailto:${email}">${email}</a><br>Singapore</p>
		</aside>
	</main>
	<div class="cursor-image" id="cursor_image" aria-hidden="true"><img alt=""><div class="cap"></div></div>`;
}

function projectMain(w) {
	const m = w.meta;
	const next = works[(works.indexOf(w) + 1) % works.length];
	const prev = works[(works.indexOf(w) - 1 + works.length) % works.length];
	const dl = [
		['Year', w.year],
		['Category', w.category],
		m.techniques && ['Techniques', esc(m.techniques)],
		m.client && [esc(m.client_label || 'Client'), esc(m.client)]
	].filter(Boolean).map(([k, v]) => `\t\t\t\t<dt>${k}</dt><dd>${v}</dd>`).join('\n');
	return `<main class="project">
		<section class="hero">
			<h1>${splitTitle(w.title)}<small>${w.year}</small></h1>
			${m.line ? `<p class="line">${esc(m.line)}</p>` : ''}
			<p class="facts"><span>${w.category}</span>${m.client ? `<span>${esc(m.client)}</span>` : ''}</p>
			<p class="scroll-cue">Scroll<i>↓</i></p>
		</section>
		<div class="body">
			<div class="text">
				<dl>
${dl}
				</dl>
				${w.context ? `<p class="context">${fixLinks(w.context, w.slug)}</p>` : ''}
				<div class="prose">
${fixLinks(w.body, w.slug)}
				</div>
			</div>
			<div class="plates">
${w.images.map((im, i) => `\t\t\t\t<figure><img src="${im.src}" width="${im.width}" height="${im.height}" alt="" loading="${i ? 'lazy' : 'eager'}"><figcaption>${i + 1} / ${w.images.length}</figcaption></figure>`).join('\n')}
			</div>
			<nav class="prevnext" aria-label="Neighbouring projects">
				<a href="${url(prev.slug)}"><span>←</span> ${esc(prev.title)}</a>
				<a href="${url(next.slug)}">${esc(next.title)} <span>→</span></a>
			</nav>
		</div>
	</main>`;
}

function fieldMain() {
	let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
	const tiles = works.map((w, i) => {
		const x = 30 + rnd() * 62, y = 8 + rnd() * 76, wv = 11 + rnd() * 9, z = (0.4 + rnd() * 1.2).toFixed(2);
		return `\t\t\t<a href="${url(w.slug)}" data-i="${i}" style="--x:${x.toFixed(1)}vw;--y:${y.toFixed(1)}vh;--w:${wv.toFixed(1)}vw;--z:${z}"><img src="${w.cover.src}" width="${w.cover.width}" height="${w.cover.height}" alt="" loading="${i < 10 ? 'eager' : 'lazy'}"><span class="label">${esc(w.title)}, ${w.year}</span></a>`;
	}).join('\n');
	const side = nav.groups.map(g => `\t\t\t<p class="group">${g.label}</p>\n${works.filter(x => x.category === g.label).map(w => `\t\t\t<a href="${url(w.slug)}" data-i="${works.indexOf(w)}">${esc(w.title)}<small>${w.year}</small></a>`).join('\n')}`).join('\n');
	return `<main class="field-page">
		<h1 class="visually-hidden">All projects</h1>
		<div class="field" id="field">
${tiles}
		</div>
		<nav class="field-side" aria-label="Projects">
${side}
		</nav>
		<p class="hint">Hover a title, or wander. Click to open.</p>
		<p class="count">${works.length} projects, ${yearRange}</p>
	</main>`;
}

function aboutMain(page) {
	return `<main class="about">
		<article>
			<h1 class="visually-hidden">${esc(page.title_no_html)}</h1>
			<div class="prose">
${fixLinks(convert.prose(page.content), page.slug)}
			</div>
		</article>
	</main>`;
}

/* --------------------------------------------------------------- template */
function render(page) {
	const isHome = page.slug === site.homepage;
	const w = workBySlug[page.slug];
	const title = isHome ? site.title : `${page.title_no_html} - ${site.title}`;
	const canonical = isHome ? site.url : `${site.url}/${page.slug}`;
	const desc = w && w.meta.line ? w.meta.line : site.description;
	const ogImage = w ? `${site.url}${w.page.images[0].src}` : `${site.url}${site.social_image}`;

	let kind, backdrop, main;
	if (isHome) { kind = 'home'; backdrop = slitHTML(home.backdrop.image); main = homeMain(); }
	else if (w) { kind = 'project'; backdrop = slitHTML(w.page.images[0], { random: true, light: true, settings: { scan_cycles: 3, wiggle: 6, target_speed: 30, flip_y: true } }); main = projectMain(w); }
	else if (page.slug === FIELD_SLUG) { kind = 'field'; backdrop = slitHTML(home.backdrop.image); main = fieldMain(); }
	else { kind = 'about'; backdrop = ''; main = aboutMain(page); }

	return `<!DOCTYPE html>
<html lang="en" data-page="${kind}">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<meta name="robots" content="index,follow">
		<title>${esc(title)}</title>
		<meta name="description" content="${esc(desc)}">
		<link rel="canonical" href="${canonical}">

		<meta name="twitter:card" content="summary_large_image">
		<meta name="twitter:title" content="${esc(title)}">
		<meta name="twitter:description" content="${esc(desc)}">
		<meta name="twitter:image" content="${ogImage}">
		<meta property="og:locale" content="en_US">
		<meta property="og:title" content="${esc(title)}">
		<meta property="og:description" content="${esc(desc)}">
		<meta property="og:url" content="${canonical}">
		<meta property="og:image" content="${ogImage}">
		<meta property="og:type" content="website">
		<meta name="theme-color" content="${kind === 'about' ? '#ffffff' : '#111111'}">

		<link rel="icon" href="${asset(site.favicon)}">
		<link rel="preload" href="${asset('/fonts/AustinNewsDeck-Light.otf')}" as="font" type="font/otf" crossorigin>
		<link rel="stylesheet" href="${asset('/css/site.css')}">
		<script src="${asset('/js/backdrops.js')}" defer></script>
		<script src="${asset('/js/site.js')}" defer></script>
	</head>
	<body>
		${backdrop}
		${barHTML(page)}
		${main}
		${footerHTML()}
	</body>
</html>
`;
}

/* ------------------------------------------------------------------ build */
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
for (const dir of ['css', 'js', 'fonts', 'img']) {
	if (fs.existsSync(path.join(SRC, dir))) copyDir(path.join(SRC, dir), path.join(OUT, dir));
}
fs.copyFileSync(path.join(SRC, 'favicon.ico'), path.join(OUT, 'favicon.ico'));

let count = 0;
const all = pages.concat([{ slug: FIELD_SLUG, title_no_html: 'All projects', content: '' }]);
for (const page of all) {
	const html = render(page);
	if (page.slug === site.homepage) fs.writeFileSync(path.join(OUT, 'index.html'), html);
	else fs.writeFileSync(path.join(OUT, page.slug + '.html'), html);
	count++;
}

if (!RELATIVE) {
	fs.writeFileSync(path.join(OUT, '_redirects'), `/${site.homepage}  /  301\n`);
	fs.writeFileSync(path.join(OUT, '_headers'), `/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
}

console.log(`built ${count} pages -> ${path.relative(ROOT, OUT)}/`);
