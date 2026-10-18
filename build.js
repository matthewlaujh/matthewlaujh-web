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
	const images = p.images.map(im => Object.assign({}, im, {
		src: asset(im.src),
		video: /\.webm$/i.test(im.src),
		mp4: im.mp4 && asset(im.mp4),
		poster: im.poster && asset(im.poster),
		thumb: asset(im.thumb || im.poster || im.src)
	}));
	return { page: p, slug: p.slug, title, year, category: g.label, context, body, images, cover: images[0], meta: p.meta || {} };
}));
const workBySlug = Object.fromEntries(works.map(w => [w.slug, w]));
const years = works.map(w => parseInt(w.year, 10)).filter(Boolean);
const yearRange = Math.min(...years) + '–' + Math.max(...years);

/* ------------------------------------------------------------- fragments */
/* the hover preview wants a small still: first non-GIF image, else the GIF's poster JPG */
function hoverImage(w) {
	const still = w.images.find(im => !im.video);
	return (still || w.cover).thumb;
}
/* a still for places that need one (slit-scan texture, og:image) */
function stillOf(im) { return im.video ? im.poster : im.src; }
/* <img> or a silent looping <video> for a plate */
function mediaHTML(im, attrs) {
	if (!im.video) {
		// the ≤1200px thumb serves 1x screens; the full file only when the slot needs it
		const tw = Math.round(im.width * Math.min(1, 1200 / Math.max(im.width, im.height)));
		const srcset = im.thumb && im.thumb !== im.src && tw < im.width ? ` srcset="${im.thumb} ${tw}w, ${im.src} ${im.width}w" sizes="(max-width: 800px) 100vw, 62vw"` : '';
		return `<img src="${im.src}"${srcset} width="${im.width}" height="${im.height}" alt="" decoding="async"${attrs || ''}>`;
	}
	const eager = /eager/.test(attrs || '');
	return `<video muted loop playsinline preload="${eager ? 'auto' : 'none'}"${eager ? ' autoplay' : ''} poster="${im.poster}" width="${im.width}" height="${im.height}" aria-label=""><source src="${im.src}" type="video/webm"><source src="${im.mp4}" type="video/mp4"></video>`;
}

const kcls = k => k === 'art' ? ' k--art' : k === 'both' ? ' k--both' : '';

function splitTitle(t) {
	// each letter gets its own span so the hover wave / rise can stagger
	return t.split(' ').map((word, wi) => `<span class="w">${[...word].map((c, k) => `<span class="ch" style="--d:${(wi * 6 + k) * 18}ms">${esc(c)}</span>`).join('')}</span>`).join(' ');
}

function dropdownHTML(current) {
	const groups = nav.groups.map(g => `\t\t<section>\n\t\t\t<h3>${g.label}</h3>\n${g.items.map(it => {
		if (it.href && workBySlug[it.href]) {
			const w = workBySlug[it.href];
			return `\t\t\t<a href="${url(w.slug)}"${w.slug === current ? ' aria-current="page"' : ''}><i class="k${kcls((w.meta || {}).kind)}" aria-hidden="true"></i>${esc(w.title)}<small>${w.year}</small></a>`;
		}
		return `\t\t\t<span class="dead" title="Coming soon">${it.text}</span>`;
	}).join('\n')}\n\t\t</section>`).join('\n');
	return `<div class="scrim" id="scrim"></div>
	<div class="dropdown" id="dropdown" aria-label="Projects">
${groups}
		<div class="foot">
			<a href="${url(FIELD_SLUG)}"${current === FIELD_SLUG ? ' aria-current="page"' : ''}>Works in space →</a>
			<a href="${url('About')}"${current === 'About' ? ' aria-current="page"' : ''}>About</a>
		</div>
	</div>`;
}

function barHTML(page) {
	const isHome = page.slug === site.homepage;
	const w = workBySlug[page.slug];
	let mid = 'Projects', midYear = '';
	if (w) { mid = esc(w.title); midYear = w.year; }
	else if (page.slug === FIELD_SLUG) mid = 'Works in space';
	else if (page.slug === 'About') mid = 'About';
	else if (page.slug === '404') mid = 'Not found';
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
		<span class="rights">© ${YEAR} Matthew Lau. All rights reserved.</span>
	</footer>`;
}

function slitHTML(image, opts) {
	const settings = Object.assign({}, home.backdrop.settings, opts && opts.settings || {});
	const cfg = { settings, image: { src: asset(image.src), width: image.width, height: image.height } };
	return `<div class="backdrop" data-backdrop="slitscan"${opts && opts.random ? ' data-random' : ''} aria-hidden="true"><script type="application/json">${json(cfg)}</script></div><div class="veil${opts && opts.light ? ' veil--light' : ''}" aria-hidden="true"></div>`;
}

/* the diffusion backdrop: one or more images, optionally random on load and
   cycled on scroll (site.js drives the cycling) */
function diffuseHTML(images, opts) {
	const settings = Object.assign({ random: false, scroll: false, strength: 0.8, speed: 1, blend: 0.01, fade: 2 }, opts && opts.settings || {});
	const cfg = { settings, images: images.map(im => ({ src: im.src, width: im.width, height: im.height })) };
	const poster = opts && opts.poster ? `<div class="poster" style="background-image:url('${opts.poster}')" aria-hidden="true"></div>` : '';
	return `<div class="backdrop" data-backdrop="diffuse" aria-hidden="true"><script type="application/json">${json(cfg)}</script></div>${poster}<div class="veil${opts && opts.light ? ' veil--light' : ''}" aria-hidden="true"></div>`;
}
/* every project's cover as a small still, for the home / field backdrop */
function coverStills() {
	return works.map(w => { const im = w.images.find(i => !i.video) || w.cover; return { src: im.thumb, width: im.width, height: im.height }; });
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
			const m = w.meta || {};
			const facts = [['Category', w.category], ['Techniques', m.techniques], [m.client_label || 'Client', m.client]].filter(x => x[1]).map(([k, v]) => `<span class="fact"><b>${esc(k)}</b>${esc(v)}</span>`).join('');
			return `\t\t\t<div class="item"><a href="${url(w.slug)}" data-i="${works.indexOf(w)}" data-img="${hoverImage(w)}" data-title="${esc(w.title)}" data-year="${w.year}"><i class="k${kcls(m.kind)}" aria-hidden="true"></i>${splitTitle(w.title)}<small>${w.year}</small></a><div class="more"><div><a class="more-in" href="${url(w.slug)}" tabindex="-1" aria-hidden="true"><img class="thumb" alt="" width="${w.cover.width}" height="${w.cover.height}" data-src="${hoverImage(w)}"><div class="text">${m.line ? `<p class="line">${esc(m.line)}</p>` : ''}<p class="facts">${facts}</p></div></a></div></div></div>`;
		}
		return `\t\t\t<span class="dead" title="Coming soon">${splitTitle(it.text.replace(/\s*\(.*\)$/, ''))}<small>${(it.text.match(/\((.*)\)/) || [])[1] || ''}</small></span>`;
	}).join('\n')}`).join('\n');
	return `<main class="home">
		<h1 class="visually-hidden">${esc(site.title)}</h1>
		<nav class="marquee" aria-label="Projects">
			<p class="legend"><span><i class="k" aria-hidden="true"></i>Design and Technology</span><span><i class="k k--art" aria-hidden="true"></i>Art Practice</span><span><i class="k k--both" aria-hidden="true"></i>Both</span></p>
${list}
			<a class="space" href="${url(FIELD_SLUG)}">All works in space<small>${works.length}</small></a>
		</nav>
		<aside class="home-aside">
			${introHTML(site.homepage)}
			<a class="more" href="${url('About')}">More about me</a>
			<p class="contact"><a href="mailto:${email}">${email}</a><br>Singapore</p>
		</aside>
	</main>`;
}

function projectMain(w) {
	const m = w.meta;
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
${w.images.map((im, i) => `\t\t\t\t<figure>${mediaHTML(im, ` loading="${i ? 'lazy' : 'eager'}"`)}<figcaption>${i + 1} / ${w.images.length}</figcaption></figure>`).join('\n')}
			</div>
		</div>
	</main>`;
}

function fieldMain() {
	/* The map itself is laid out in site.js (setupField) so it fits any window:
	   one cluster per category, art drifting lower-left and design upper-right,
	   tiles nudged apart until none overlap. Here we only emit the tiles. */
	const tiles = works.map((w, i) => {
		const k = (w.meta || {}).kind || 'design';
		return `\t\t\t<a href="${url(w.slug)}" data-i="${i}" data-kind="${k}" data-cat="${esc(w.category)}" data-year="${String(w.year).slice(0, 4)}"><img src="${w.cover.thumb}" width="${w.cover.width}" height="${w.cover.height}" alt="" loading="${i < 10 ? 'eager' : 'lazy'}"><span class="label"><i class="k${kcls(k)}" aria-hidden="true"></i>${esc(w.title)}, ${w.year}</span></a>`;
	});
	const marks = nav.groups.map(g => `\t\t\t<span class="cluster" data-cat="${esc(g.label)}">${esc(g.label)}</span>`).join('\n');
	/* the timeline: one lane per category, one column per year, newest first */
	const yrs = [...new Set(works.map(w => +String(w.year).slice(0, 4)))].sort((a, b) => b - a);
	const lanes = nav.groups.map(g => `\t\t\t<div class="lane"><span class="lane-label">${esc(g.label)}</span>${yrs.map(y => `<div class="cell">${works.filter(w => w.category === g.label && +String(w.year).slice(0, 4) === y).map(w => `<a href="${url(w.slug)}" data-i="${works.indexOf(w)}" title="${esc(w.title)}"><i class="k${kcls((w.meta || {}).kind)}" aria-hidden="true"></i>${esc(w.title)}</a>`).join('')}</div>`).join('')}</div>`).join('\n');
	const axis = `\t\t\t<div class="axis"><span class="lane-label"></span>${yrs.map(y => `<span>${y}</span>`).join('')}</div>`;
	return `<main class="field-page">
		<h1 class="visually-hidden">Works in space</h1>
		<div class="field" id="field" data-cats="${esc(nav.groups.map(g => g.label).join('|'))}">
${marks}
${tiles.join('\n')}
		</div>
		<nav class="field-time" aria-label="Projects by year" style="--n:${yrs.length}">
${axis}
${lanes}
		</nav>
		<p class="hint">Projects sit near their kind. Hover a title, or wander. Click to open.</p>
		<p class="count"><span><i class="k" aria-hidden="true"></i>Design and Technology</span><span><i class="k k--art" aria-hidden="true"></i>Art Practice</span><span><i class="k k--both" aria-hidden="true"></i>Both</span></p>
	</main>`;
}

function aboutMain(page) {
	const a = readJSON(path.join(SRC, 'about.json'));
	const L = h => fixLinks(h, page.slug);
	const entry = e => `				<div class="entry${e.kind === 'art' ? ' art' : ''}">
					<div class="dates">${e.dates}</div>
					<div class="main">
						<div class="role"><i class="k${kcls(e.kind)}" aria-hidden="true"></i><span>${L(e.role)}</span></div>
						${e.org ? `<div class="org">${e.org_url ? `<a href="${e.org_url}" target="_blank" rel="noopener">${esc(e.org)}</a>` : esc(e.org)}</div>` : ''}
						${e.place ? `<div class="org place">${esc(e.place)}</div>` : ''}
						${e.note ? `<div class="note">${L(e.note)}</div>` : ''}
						${e.bullets && e.bullets.length ? `<ul>${e.bullets.map(b => `<li>${L(b)}</li>`).join('')}</ul>` : ''}
					</div>
				</div>`;
	const section = name => {
		const sec = a.sections.find(s => s.title === name);
		return sec ? `			<section>\n				<h2>${esc(sec.title)}</h2>\n${sec.entries.map(entry).join('\n')}\n			</section>` : '';
	};
	const skills = a.skills ? `<section class="skills"><h2>Skills</h2><dl>${a.skills.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : '';
	return `<main class="about">
		<h1 class="visually-hidden">${esc(page.title_no_html)}</h1>
		<p class="legend"><span><i class="k" aria-hidden="true"></i>Design and Technology</span><span><i class="k k--art" aria-hidden="true"></i>Art Practice</span><span><i class="k k--both" aria-hidden="true"></i>Both</span></p>
		<div class="contact">
			<a href="mailto:${a.contact.email}">${a.contact.email}</a>
			<a href="${a.contact.resume}" target="_blank" rel="noopener">Resume (PDF)</a>
			${a.contact.github ? `<a href="${a.contact.github}" target="_blank" rel="noopener">GitHub</a>` : ''}
			${a.contact.linkedin ? `<a href="${a.contact.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
			<span>${esc(a.contact.location)}</span>
		</div>
		<div class="heads">
			<div class="lede"><h2><i class="k" aria-hidden="true"></i>${esc(a.lede_title)}</h2>${a.lede.map(p => `<p>${p}</p>`).join('')}</div>
			<div class="lede"><h2><i class="k k--art" aria-hidden="true"></i>${esc(a.statement_title)}</h2>${a.statement.map(p => `<p>${p}</p>`).join('')}</div>
		</div>
		<div class="cv">
			<div class="pair">
${section('Experience')}
${section('Education')}
			</div>
${section('Group exhibitions')}
			${skills}
		</div>
	</main>`;
}

/* --------------------------------------------------------------- template */
/* typographic hygiene on rendered text (never inside tags or scripts):
   curly apostrophes and quotes, en dashes in year ranges and spaced hyphens,
   a thin no-break space before the year in "Title 2026" is left to CSS. */
function typo(html) {
	html = html.replace(/(<\/(?:a|i|em|b|strong)>) +([.,;:!?])/g, '$1$2');   // "...</a> ." -> "...</a>."
	return html.split(/(<script[\s\S]*?<\/script>|<[^>]+>)/g).map((part, i) => {
		if (i % 2) return part;                               // a tag or a script block
		return part
			.replace(/(\w)'(\w)/g, '$1\u2019$2')                // it's, I'm, Matthew's
			.replace(/(^|[\s(])'(?=\w)/g, '$1\u2018')            // opening single
			.replace(/'/g, '\u2019')
			.replace(/(^|[\s(])"(?=\S)/g, '$1\u201c')            // opening double
			.replace(/"/g, '\u201d')
			.replace(/\b(\d+)-(\d+)\b/g, '$1\u2013$2')             // 2021–2022, ages 18–30
			.replace(/ - /g, ' \u2013 ')                          // spaced hyphen -> en dash
			.replace(/\.\.\./g, '\u2026');
	}).join('');
}

function render(page) {
	const isHome = page.slug === site.homepage;
	const w = workBySlug[page.slug];
	const title = isHome ? site.title : `${page.title_no_html} - ${site.title}`;
	const canonical = isHome ? site.url : `${site.url}/${page.slug}`;
	const desc = w && w.meta.line ? w.meta.line : site.description;
	const ogImage = w ? `${site.url}${w.cover.video ? w.page.images[0].poster : w.page.images[0].src}` : `${site.url}${site.social_image}`;

	let kind, backdrop, main;
	if (isHome) { kind = 'home'; backdrop = diffuseHTML(coverStills(), { settings: { random: true, scroll: true } }); main = homeMain(); }
	else if (w) { kind = 'project'; backdrop = diffuseHTML([{ src: w.cover.video ? w.cover.poster : w.cover.thumb, width: w.cover.width, height: w.cover.height }], { light: true, poster: w.cover.video ? w.cover.poster : w.cover.thumb, settings: { strength: 0.55 } }); main = projectMain(w); }
	else if (page.slug === FIELD_SLUG) { kind = 'field'; backdrop = diffuseHTML(coverStills(), { settings: { random: true, scroll: false, strength: 0.5 } }); main = fieldMain(); }
	else if (page.slug === '404') { kind = 'about'; backdrop = ''; main = `<main class="about notfound">
		<h1>Nothing here.</h1>
		<p>That page may have moved. Try the <a href="${url(site.homepage)}">home page</a>, <a href="${url(FIELD_SLUG)}">works in space</a> or <a href="${url('About')}">about</a>.</p>
	</main>`; }
	else { kind = 'about'; backdrop = ''; main = aboutMain(page); }

	return `<!DOCTYPE html>
<html lang="en" data-page="${kind}">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<meta name="robots" content="${page.slug === '404' ? 'noindex' : 'index,follow'}">
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
		<link rel="preload" href="${asset('/fonts/AustinNewsDeck-Light.woff2')}" as="font" type="font/woff2" crossorigin>
		<link rel="preload" href="${asset('/fonts/AtlasGrotesk-Light.woff2')}" as="font" type="font/woff2" crossorigin>
		<link rel="stylesheet" href="${asset('/css/site.css')}">
		<script src="${asset('/js/backdrops.js')}" defer></script>
		<script src="${asset('/js/site.js')}" defer></script>
	</head>
	<body>
		${backdrop}
${typo(`		${barHTML(page)}
		${main}
		${footerHTML()}`)}
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
const all = pages.concat([{ slug: FIELD_SLUG, title_no_html: 'Works in space', content: '' }, { slug: '404', title_no_html: 'Not found', content: '' }]);
for (const page of all) {
	const html = render(page);
	if (page.slug === site.homepage) fs.writeFileSync(path.join(OUT, 'index.html'), html);
	else fs.writeFileSync(path.join(OUT, page.slug + '.html'), html);
	count++;
}

if (!RELATIVE) {
	fs.writeFileSync(path.join(OUT, '_redirects'), `/${site.homepage}  /  301\n/Archifest-2021-Sea-of-Debris-2021  /NewWave-2021  301\n/The-LASALLE-Show-Faculty-of-Design-BA-Hons-Graduate-Exhibition  /Proximate-2022  301\n`);
	fs.writeFileSync(path.join(OUT, '_headers'), `/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
}

console.log(`built ${count} pages -> ${path.relative(ROOT, OUT)}/`);
