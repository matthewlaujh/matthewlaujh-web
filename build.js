#!/usr/bin/env node
/*
 * Static build for matthewlaujh.com (ported from Cargo 2).
 *
 *   node build.js
 *
 * Reads src/site.json, src/pages/*.json, src/pinned/*.json and writes one
 * HTML file per page into public/, plus copies css/js/fonts/img.
 * No dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');

const site = readJSON(path.join(SRC, 'site.json'));
const nav = readJSON(path.join(SRC, 'pinned', 'nav.json'));
const info = readJSON(path.join(SRC, 'pinned', 'info.json'));
const pages = fs.readdirSync(path.join(SRC, 'pages'))
	.filter(f => f.endsWith('.json'))
	.map(f => readJSON(path.join(SRC, 'pages', f)));
const bySlug = Object.fromEntries(pages.map(p => [p.slug, p]));
const home = bySlug[site.homepage];

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

/* Cargo stored links as bare slugs ("Ambi-latent-Space-2025"); make them
   root-relative so they resolve from any page, and mark the current page's
   link active (Cargo: `.page a.active { font-weight: bold }`). */
function fixLinks(htmlStr, currentSlug) {
	return htmlStr.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>/g, (m, pre, href, post) => {
		let h = href;
		if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(h) && bySlug[h]) {
			h = h === site.homepage ? '/' : '/' + h;
		} else if (h === '/' + site.homepage) {
			h = '/';
		}
		const isCurrent = h === '/' + currentSlug && currentSlug !== site.homepage;
		let attrs = pre + 'href="' + h + '"' + post;
		if (isCurrent) {
			attrs = /\bclass="/.test(attrs) ? attrs.replace(/\bclass="/, 'class="active ') : attrs + ' class="active"';
		}
		return '<a' + attrs + '>';
	});
}

/* ------------------------------------------------------------- fragments */
function backdropHTML(page) {
	const bd = page.backdrop;
	if (!bd) return '';
	const cfg = { settings: bd.settings };
	if (bd.type === 'slitscan') cfg.image = bd.image;
	if (bd.type === 'wallpaper') cfg.images = page.images;
	return `
		<div data-backdrop="${bd.type}" class="backdrop" data-id="${page.id}">
			<div class="backdrop_viewport"></div>
			<script type="application/json">${JSON.stringify(cfg).replace(/<\/script/gi, '<\\/script')}</script>
		</div>`;
}

function pageContainer(page, currentSlug, extraClass) {
	return `
	<div data-container="page" class="page_container${extraClass ? ' ' + extraClass : ''}" local-style="${page.id}" data-id="${page.id}">
		<div class="page container container_width clearfix" data-container="content" data-id="${page.id}">
			<bodycopy class="bodycopy content content_padding">
				<div class="page_content clearfix">
					<projectcontent>${fixLinks(page.content, currentSlug)}</projectcontent>
				</div>
			</bodycopy>
		</div>
		<div class="page_background"></div>
		<style class="local-css" data-target="${page.id}">
${page.local_css || ''}
		</style>${backdropHTML(page)}
	</div>`;
}

function pinnedHTML(page, position, currentSlug) {
	const o = page.pin_options || {};
	const cls = ['overlay', o.fixed ? 'fixed' : '', o.exclude_mobile ? 'exclude_mobile' : '', o.exclude_desktop ? 'exclude_desktop' : ''].filter(Boolean).join(' ');
	return `
			<div data-position="${position}" class="pinned pinned_${position}">${pageContainer(page, currentSlug, cls)}
			</div>`;
}

const MENU_ICON = `<svg viewBox="0 0 34 34" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M4 8h26M4 17h26M4 26h26"/></g></svg>`;

/* --------------------------------------------------------------- template */
function render(page) {
	const isHome = page.slug === site.homepage;
	const title = isHome ? site.title : `${page.title_no_html} - ${site.title}`;
	const canonical = isHome ? site.url : `${site.url}/${page.slug}`;
	const desc = site.description;

	return `<!DOCTYPE html>
<html lang="en" data-predefined-style="true" data-css-presets="true" data-css-preset data-typography-preset>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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

		<link rel="shortcut icon" href="${site.favicon}">
		<link rel="stylesheet" href="/css/cargo-base.css">
		<link rel="stylesheet" href="/css/stylesheet.css">
		<link rel="stylesheet" href="/css/site.css">
		<script src="/js/backdrops.js" defer></script>
		<script src="/js/site.js" defer></script>
	</head>
	<body class="${isHome ? 'homepage' : ''}" style="visibility: hidden;">
		<customhtml></customhtml>

		<div id="site_menu_wrapper" class="mobile_only" data-sitemenu-position="top-right" data-type="page">
			<a href="/" id="site_menu_button" aria-label="Menu">${MENU_ICON}</a>
			<div id="site_menu_panel_container" data-type="page">
				<div class="site_menu_page_wrapper">${pageContainer(home, page.slug)}
					<div id="site_menu_page_overlay"></div>
				</div>
			</div>
		</div>

		<div class="main_container">
${pinnedHTML(nav, 'top', page.slug)}

			<div class="content_container">
				<div data-view="Content">${pageContainer(page, page.slug)}
				</div>
			</div>
${pinnedHTML(info, 'bottom', page.slug)}
		</div>
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
	fs.writeFileSync(path.join(OUT, page.slug + '.html'), html);
	count++;
	if (page.slug === site.homepage) fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

// Cloudflare Pages: serve clean URLs, keep /Front-Page working as an alias of /
fs.writeFileSync(path.join(OUT, '_redirects'), `/${site.homepage}  /  301\n`);
fs.writeFileSync(path.join(OUT, '_headers'), `/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

console.log(`built ${count} pages -> ${path.relative(ROOT, OUT)}/`);
