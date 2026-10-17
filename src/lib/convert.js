/*
 * Converts the Cargo content HTML stored in src/pages/*.json into semantic HTML.
 *
 * Cargo's editor produced:  <div grid-row><div grid-col="5"><h1>text<br><br>text<br>—<br>…</h1></div></div>
 * We produce:               <p>text</p><p>text</p><hr>…  (+ <ul><li> for "• " lines)
 */
'use strict';

/** Pull the inner HTML of every grid column, in order. */
function columns(html) {
	const out = [];
	const re = /<div grid-col="([^"]*)"[^>]*>([\s\S]*?)<\/div>\s*(?=<div grid-col|<\/div>)/g;
	let m;
	while ((m = re.exec(html))) out.push({ span: m[1], html: m[2] });
	return out;
}

function isBlank(html) {
	return html.replace(/<br\s*\/?>|<h1>\s*<\/h1>|\s|&nbsp;/g, '') === '';
}

/** The text column of a page = the first grid column with real content. */
function textColumn(html) {
	return columns(html).filter(c => !isBlank(c.html));
}

/**
 * Turn a run of Cargo "h1 + <br>" prose into paragraphs.
 * - two or more <br> in a row (whitespace between allowed) → paragraph break
 * - a line that is only "—" → <hr>
 * - lines starting with "• " → list items
 * - a single <br> stays as a line break inside the paragraph
 */
function blocks(html) {
	let s = html;
	// unwrap Cargo's h1 (it was styled as body copy) and empty tags
	s = s.replace(/<\/?h1[^>]*>/g, '\n\n');
	s = s.replace(/<br\s*\/?>/g, '\n');
	s = s.replace(/[ \t]+\n/g, '\n');
	// normalise exotic whitespace runs
	s = s.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');

	const paras = s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
	const out = [];
	let list = null;
	const flushList = () => { if (list) { out.push('<ul>\n' + list.join('\n') + '\n</ul>'); list = null; } };

	for (let p of paras) {
		const text = p.replace(/<[^>]+>/g, '').trim();
		if (text === '—' || text === '-') { flushList(); out.push('<hr>'); continue; }
		// a trailing "—" on a paragraph (Cargo used it as a rule)
		let rule = false;
		if (/\n?—\s*$/.test(p)) { p = p.replace(/\n?—\s*$/, '').trim(); rule = true; }
		// short label lines ending in a colon ("Education:") are section headings
		if (text.length < 40 && /:$/.test(text) && !/<a /.test(p)) {
			flushList();
			out.push('<h2>' + p.replace(/^\s*•\s*/, '').replace(/:\s*$/, '') + '</h2>');
			continue;
		}
		if (/^•\s*/.test(text)) {
			if (!list) list = [];
			list.push('\t<li>' + p.replace(/^\s*•\s*/, '').replace(/\n/g, '<br>\n') + '</li>');
		} else {
			flushList();
			if (p) out.push('<p>' + p.replace(/\n/g, '<br>\n') + '</p>');
		}
		if (rule) { flushList(); out.push('<hr>'); }
	}
	flushList();
	return out.join('\n');
}

/** Project / About pages → semantic prose. */
function prose(pageContent) {
	return textColumn(pageContent).map(c => blocks(c.html)).join('\n');
}

/**
 * The Nav page → { title, groups: [{ label, items: [{ text, href }] }] }
 * Cargo stored it as: "Projects:<br><br>Experiential:<br><a>…</a><br>…<br>—<br><br>Computational:<br>…"
 */
function navModel(navContent) {
	const col = textColumn(navContent)[0].html
		// a <br> that Cargo left inside an anchor would split it across lines
		.replace(/(<a\b[^>]*>[^<]*)<br\s*\/?>\s*(<\/a>)/g, '$1$2');
	const lines = col
		.replace(/<\/?h1[^>]*>/g, '\n')
		.replace(/<br\s*\/?>/g, '\n')
		.split('\n').map(l => l.trim()).filter(Boolean);
	const model = { title: null, titleHref: null, heading: null, groups: [] };
	let group = null;
	for (const line of lines) {
		const link = line.match(/^<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*$/);
		const text = line.replace(/<[^>]+>/g, '').trim();
		if (!model.title && text) {
			model.title = text;
			if (link) model.titleHref = link[1];
			continue;
		}
		if (/^Projects:?$/i.test(text)) { model.heading = text.replace(/:$/, ''); continue; }
		if (text === '—') { group = null; continue; }
		if (/:$/.test(text) && !link) { group = { label: text.replace(/:$/, ''), items: [] }; model.groups.push(group); continue; }
		if (!text) continue;
		if (!group) { group = { label: '', items: [] }; model.groups.push(group); }
		group.items.push({ text: text.replace(/\s+/g, ' '), href: link ? link[1] : null });
	}
	return model;
}

module.exports = { columns, textColumn, blocks, prose, navModel };
