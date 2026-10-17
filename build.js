#!/usr/bin/env node
/*
 * Static build for matthewlaujh.com (v2 — semantic markup).
 *
 *   node build.js              -> public/   (root-relative URLs, for Cloudflare Pages)
 *   node build.js --relative   -> preview/  (relative URLs, for the artifact preview)
 *
 * Reads src/site.json, src/pages/*.json, src/pinned/*.json; converts the Cargo
 * content HTML to semantic HTML (src/lib/convert.js); writes one HTML file per
 * page plus css/js/fonts/img. No dependencies.
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
/** internal link for a Cargo slug */
function url(slug) {
	if (!slug || slug === site.homepage) return RELATIVE ? 'index.html' : '/';
	return RELATIVE ? slug + '.html' : '/' + slug;
}
function asset(p) { return RELATIVE ? p.replace(/^\//, '') : p; }

/* Cargo stored links as bare slugs; make them real URLs. Links to pages that
   don't exist are left as plain text (Cargo 404'd on them). */
function fixLinks(htmlStr, currentSlug) {
	return htmlStr.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, href, post, inner) => {
		let attrs = (pre + post).replace(/\s*rel="history"/, '').replace(/\s+/g, ' ').trim();
		if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(href)) {
			if (!bySlug[href]) return inner; // dead internal link
			const h = url(href);
			if (href === currentSlug && currentSlug !== site.homepage) attrs += ' aria-current="page"';
			return `<a href="${h}"${attrs ? ' ' + attrs : ''}>${inner}</a>`;
		}
		if (/^https?:\/\//.test(href) && !/rel=/.test(attrs)) attrs += ' rel="noopener"';
		return `<a href="${href}"${attrs ? ' ' + attrs : ''}>${inner}</a>`;
	});
}

/* ------------------------------------------------------------- fragments */
function navHTML(currentSlug) {
	const groups = nav.groups.map(g => {
		const items = g.items.map(it => {
			if (it.href && bySlug[it.href]) {
				const cur = it.href === currentSlug;
				return `\t\t\t\t<li><a href="${url(it.href)}"${cur ? ' class="active" aria-current="page"' : ''}>${it.text}</a></li>`;
			}
			return `\t\t\t\t<li><span class="dead" title="Coming soon">${it.text}</span></li>`;
		}).join('\n');
		return `\t\t<section class="nav-group">\n\t\t\t<h2>${g.label}</h2>\n\t\t\t<ul>\n${items}\n\t\t\t</ul>\n\t\t</section>`;
	}).join('\n');
	return `<nav class="site-nav" aria-label="Projects">
		<a class="site-title" href="${url(site.homepage)}">${nav.title}</a>
		<p class="nav-heading">${nav.heading}</p>
${groups}
	</nav>`;
}

function clockHTML() {
	return `<span class="studio-clock" aria-live="off"><span class="dot" aria-hidden="true"></span><span class="clock-text">Studio · Singapore</span></span>`;
}

function footerHTML(extraClass) {
	return `<footer class="site-footer${extraClass ? ' ' + extraClass : ''}">
		<a href="mailto:${email}">${email}</a>
		${clockHTML()}
	</footer>`;
}

function backdropHTML(page) {
	const bd = page.backdrop;
	if (!bd) return '';
	const cfg = { settings: bd.settings };
	if (bd.type === 'slitscan') cfg.image = Object.assign({}, bd.image, { src: asset(bd.image.src) });
	if (bd.type === 'wallpaper') cfg.images = page.images.map(i => Object.assign({}, i, { src: asset(i.src) }));
	return `<div class="backdrop" data-backdrop="${bd.type}" aria-hidden="true"><script type="application/json">${JSON.stringify(cfg).replace(/<\/script/gi, '<\\/script')}</script></div>`;
}

function introHTML(currentSlug) {
	// the Front Page's second column (the intro paragraph + "more about me")
	const cols = convert.textColumn(home.content);
	const intro = cols[cols.length - 1];
	return `<div class="prose">\n${fixLinks(convert.blocks(intro.html), currentSlug)}\n</div>`;
}

function mainHTML(page) {
	if (page.slug === site.homepage) {
		return `<main class="page page--home">
		<h1 class="visually-hidden">${esc(site.title)}</h1>
		${introHTML(page.slug)}
	</main>`;
	}
	const top = !/flex-end/.test(page.local_css || '');
	return `<main class="page${top ? ' page--top' : ''}">
		<article>
			<h1 class="visually-hidden">${esc(page.title_no_html)}</h1>
			<div class="prose">
${fixLinks(convert.prose(page.content), page.slug)}
			</div>
		</article>
	</main>`;
}

function menuHTML(currentSlug) {
	return `<div id="site_menu" role="dialog" aria-label="Menu">
		${backdropHTML(home)}
		<div class="menu-inner">
			${navHTML(currentSlug)}
			<div class="menu-intro">${introHTML(currentSlug)}</div>
			${footerHTML('site-footer--inline')}
		</div>
	</div>`;
}

const MENU_ICON = `<svg viewBox="0 0 34 34" aria-hidden="true" focusable="false"><line x1="4" y1="8" x2="30" y2="8"/><line x1="4" y1="17" x2="30" y2="17"/><line x1="4" y1="26" x2="30" y2="26"/></svg>`;

/* --------------------------------------------------------------- template */
function render(page) {
	const isHome = page.slug === site.homepage;
	const title = isHome ? site.title : `${page.title_no_html} - ${site.title}`;
	const canonical = isHome ? site.url : `${site.url}/${page.slug}`;
	const desc = site.description;

	return `<!DOCTYPE html>
<html lang="en">
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
		<meta name="twitter:image" content="${site.url}${site.social_image}">
		<meta property="og:locale" content="en_US">
		<meta property="og:title" content="${esc(title)}">
		<meta property="og:description" content="${esc(desc)}">
		<meta property="og:url" content="${canonical}">
		<meta property="og:image" content="${site.url}${site.social_image}">
		<meta property="og:type" content="website">
		<meta name="theme-color" content="#222222">

		<link rel="icon" href="${asset(site.favicon)}">
		<link rel="preload" href="${asset('/fonts/AustinNewsDeck-Light.otf')}" as="font" type="font/otf" crossorigin>
		<link rel="stylesheet" href="${asset('/css/site.css')}">
		<script src="${asset('/js/backdrops.js')}" defer></script>
		<script src="${asset('/js/site.js')}" defer></script>
	</head>
	<body class="${isHome ? 'homepage' : ''}" style="visibility: hidden;">
		<button id="site_menu_button" type="button" aria-controls="site_menu" aria-expanded="false" aria-label="Menu">${MENU_ICON}</button>
		<div class="site">
			${backdropHTML(page)}
			${navHTML(page.slug)}
			${mainHTML(page)}
			${footerHTML()}
		</div>
		${menuHTML(page.slug)}
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
for (const page of pages) {
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
