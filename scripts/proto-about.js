#!/usr/bin/env node
/* Four ways to put the design and art halves of About on one page with no
   toggle. Reuses the built About.html's bar/footer; swaps the <main>.
     node build.js --relative && node scripts/proto-about.js -> preview/about-{a,b,c,d}.html */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/about.json'), 'utf8'));
const built = fs.readFileSync(path.join(ROOT, 'preview/About.html'), 'utf8');
const head = built.slice(0, built.indexOf('<main'));
const tail = built.slice(built.indexOf('</main>') + 7);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const L = h => h.replace(/href="([A-Za-z0-9][A-Za-z0-9-]*)"/g, 'href="$1.html"');
const entry = e => `<div class="entry"><div class="dates">${e.dates}</div><div class="main"><div class="role">${L(e.role)}</div>${e.org ? `<div class="org">${e.org_url ? `<a href="${e.org_url}" target="_blank" rel="noopener">${esc(e.org)}</a>` : esc(e.org)}${e.place ? ` — ${esc(e.place)}` : ''}</div>` : (e.place ? `<div class="org">${esc(e.place)}</div>` : '')}${e.note ? `<div class="note">${L(e.note)}</div>` : ''}${e.bullets && e.bullets.length ? `<ul>${e.bullets.map(b => `<li>${L(b)}</li>`).join('')}</ul>` : ''}</div></div>`;
const sec = name => { const s = a.sections.find(x => x.title === name); return s ? `<section><h2>${esc(s.title)}</h2>${s.entries.map(entry).join('')}</section>` : ''; };
const skills = `<section class="skills"><h2>Skills</h2><dl>${a.skills.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
const contact = `<div class="contact"><a href="mailto:${a.contact.email}">${a.contact.email}</a><a href="${a.contact.resume}" target="_blank" rel="noopener">Resume (PDF)</a><a href="${a.contact.github}" target="_blank" rel="noopener">GitHub</a><a href="${a.contact.linkedin}" target="_blank" rel="noopener">LinkedIn</a><span>${esc(a.contact.location)}</span></div>`;
const lede = `<div class="lede"><h2>${esc(a.lede_title)}</h2>${a.lede.map(p => `<p>${p}</p>`).join('')}</div>`;
const statement = `<div class="lede"><h2>${esc(a.statement_title)}</h2>${a.statement.map(p => `<p>${p}</p>`).join('')}</div>`;
const designCV = sec('Experience') + sec('Education') + skills;
const artCV = sec('Practice') + sec('Group exhibitions');
const NAV = `<nav class="pnav" aria-label="Prototype"><span>About layout</span>${[['a','Side by side'],['b','Stacked + rail'],['c','Two worlds'],['d','One timeline']].map(([k,l]) => `<a href="about-${k}.html" data-k="${k}">${k.toUpperCase()} ${l}</a>`).join('')}<a href="About.html">current (toggle)</a></nav>
<style>.pnav{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:60;display:flex;gap:4px;align-items:center;padding:4px;border-radius:999px;background:rgba(24,24,26,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#fff;font:300 12px/1 "Atlas Grotesk",Helvetica,Arial,sans-serif;white-space:nowrap}.pnav span{padding:0 10px;color:rgba(255,255,255,.5)}.pnav a{padding:8px 12px;border-radius:999px;color:#fff}.pnav a:hover{background:rgba(255,255,255,.12)}.pnav a.on{background:#fff;color:#111}@media(max-width:800px){.pnav{bottom:52px;font-size:11px}.pnav span{display:none}}</style>`;
const page = (title, css, main) => head + `<style>${css}</style><main class="about">${main}</main>` + NAV.replace(`data-k="${title.toLowerCase()}"`, `data-k="${title.toLowerCase()}" class="on"`) + tail;
const out = {};

/* A — side by side: design left, art right, one scroll */
out['about-a'] = page('A', `
.about{display:block}
.two{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:start}
.two>div{min-width:0}
.two .lede{font-size:clamp(18px,1.6vw,22px);max-width:30em;margin-bottom:40px}
.two .cv{border-top:1px solid var(--ink);padding-top:0}
.two .cv section + section{margin-top:36px}
.two .entry{grid-template-columns:5em 1fr}
.foot{margin-top:64px;border-top:1px solid var(--ink);padding-top:16px}
.foot .contact{display:flex;gap:24px;margin:0}
@media(max-width:900px){.two{grid-template-columns:1fr;gap:56px}}
`, `<div class="two"><div>${lede}<div class="cv">${designCV}</div></div><div>${statement}<div class="cv">${artCV}</div></div></div><div class="foot">${contact}</div>`);

/* B — stacked halves with a scrollspy rail */
out['about-b'] = page('B', `
.about{display:block}
.rail{position:fixed;left:var(--pad);top:50%;transform:translateY(-50%);z-index:5;display:grid;gap:10px;font:300 12px/1 var(--sans);color:rgba(0,0,0,.4)}
.rail a{display:flex;align-items:center;gap:10px;text-decoration:none}
.rail a::before{content:"";width:18px;height:1px;background:currentColor;transition:width .3s}
.rail a.on{color:var(--ink)}.rail a.on::before{width:34px}
.half{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:48px 72px;align-items:start;padding:24px 0 72px;margin-left:72px}
.half + .half{border-top:1px solid var(--ink);padding-top:56px}
.half .side{position:sticky;top:calc(var(--bar-h) + 16px)}
@media(max-width:900px){.rail{display:none}.half{grid-template-columns:1fr;margin-left:0}.half .side{position:static}}
`, `<nav class="rail" aria-label="Sections"><a href="#design" class="on">Design &amp; technology</a><a href="#art">Art practice</a></nav>
<section class="half" id="design"><aside class="side">${lede}${contact}</aside><div class="cv">${designCV}</div></section>
<section class="half" id="art"><aside class="side">${statement}</aside><div class="cv">${artCV}</div></section>
<script>(function(){var ls=document.querySelectorAll('.rail a'),hs=document.querySelectorAll('.half');function u(){var y=scrollY+innerHeight*.4,i=0;for(var k=0;k<hs.length;k++)if(hs[k].offsetTop<=y)i=k;for(var j=0;j<ls.length;j++)ls[j].classList.toggle('on',j===i)}addEventListener('scroll',u,{passive:true});u()})()</script>`);

/* C — two worlds: design on white, art on dark */
out['about-c'] = page('C', `
.about{display:block;padding-bottom:0}
.world{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:48px 72px;align-items:start;padding:24px var(--pad) 96px;margin:0 calc(-1 * var(--pad))}
.world .side{position:sticky;top:calc(var(--bar-h) + 16px)}
.world--art{background:#141414;color:#fff;padding-top:72px;padding-bottom:140px}
.world--art .lede h2,.world--art .cv h2,.world--art .entry .dates,.world--art .entry .org,.world--art .entry .note,.world--art .entry ul,.world--art .contact{color:rgba(255,255,255,.6)}
.world--art .cv h2{border-color:#fff}.world--art .entry{border-color:rgba(255,255,255,.15)}
.world--art a{text-decoration-color:rgba(255,255,255,.4)}
.world--art .contact a{border-color:rgba(255,255,255,.4)}
.world--art .entry .role{color:#fff}
.world--art .entry ul{color:rgba(255,255,255,.7)}
@media(max-width:900px){.world{grid-template-columns:1fr}.world .side{position:static}}
`, `<section class="world"><aside class="side">${lede}${contact}</aside><div class="cv">${designCV}</div></section>
<section class="world world--art"><aside class="side">${statement}${contact}</aside><div class="cv">${artCV}</div></section>
<script>(function(){var art=document.querySelector('.world--art'),html=document.documentElement;function u(){html.setAttribute('data-glass',art.getBoundingClientRect().top<innerHeight*.5?'dark':'light')}addEventListener('scroll',u,{passive:true});u()})()</script>`);

/* D — one timeline, two voices */
const all = [];
for (const name of ['Experience', 'Education']) for (const e of a.sections.find(s => s.title === name).entries) all.push(Object.assign({ kind: 'design' }, e));
for (const name of ['Practice', 'Group exhibitions']) for (const e of a.sections.find(s => s.title === name).entries) all.push(Object.assign({ kind: 'art' }, e));
const yr = e => parseInt((e.dates.match(/\d{4}/g) || ['0']).slice(-1)[0], 10) + (e.dates.endsWith('–') ? 0.5 : 0);
all.sort((x, y) => yr(y) - yr(x));
out['about-d'] = page('D', `
.about{display:block}
.heads{display:grid;grid-template-columns:1fr 1fr;gap:72px;margin-bottom:56px}
.heads .lede{font-size:clamp(18px,1.6vw,22px);max-width:30em}
.heads .lede h2{display:flex;align-items:center;gap:8px}
.k{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ink)}
.k--art{background:none;border:1px solid var(--ink)}
.tl .entry{grid-template-columns:6.5em 1fr;position:relative}
.tl .entry .role::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ink);margin-right:10px;vertical-align:middle}
.tl .entry.art .role::before{background:none;border:1px solid var(--ink)}
.tl .entry.art .role{font-style:italic}
.tl{border-top:1px solid var(--ink)}
.foot{margin-top:64px;border-top:1px solid var(--ink);padding-top:16px}
.foot .contact{display:flex;gap:24px;margin:0}
.legend{font:300 12px/1.4 var(--sans);color:rgba(0,0,0,.5);display:flex;gap:18px;margin-bottom:10px}
.legend span{display:inline-flex;align-items:center;gap:8px}
@media(max-width:900px){.heads{grid-template-columns:1fr;gap:40px}}
`, `<div class="heads"><div class="lede"><h2><i class="k"></i>${esc(a.lede_title)}</h2>${a.lede.map(p => `<p>${p}</p>`).join('')}</div><div class="lede"><h2><i class="k k--art"></i>${esc(a.statement_title)}</h2>${a.statement.map(p => `<p>${p}</p>`).join('')}</div></div>
<div class="legend"><span><i class="k"></i>Design &amp; technology</span><span><i class="k k--art"></i>Art practice</span></div>
<div class="cv tl">${all.map(e => entry(e).replace('<div class="entry">', `<div class="entry ${e.kind}">`)).join('')}</div>
<div class="cv" style="margin-top:48px">${skills}</div>
<div class="foot">${contact}</div>`);

for (const [n, h] of Object.entries(out)) fs.writeFileSync(path.join(ROOT, 'preview', n + '.html'), h);
fs.writeFileSync(path.join(ROOT, 'preview', 'about-options.html'), `<!DOCTYPE html><html><head><meta charset="utf-8"><title>About: four layouts</title><style>body{font:300 15px/1.5 Helvetica,Arial,sans-serif;padding:40px;max-width:52rem;color:#111}h1{font-weight:300}li{margin:10px 0}a{color:inherit}</style></head><body><h1>About — four one-page layouts</h1><ol>
<li><a href="about-a.html">A · Side by side</a> — design left, art right, one scroll.</li>
<li><a href="about-b.html">B · Stacked with a rail</a> — design then art, a thin index at the left that follows your scroll.</li>
<li><a href="about-c.html">C · Two worlds</a> — design on white, art on dark; the capsules switch as you cross.</li>
<li><a href="about-d.html">D · One timeline</a> — both statements up top, then a single chronology where filled dots are design and open dots (italic) are art.</li></ol></body></html>`);
console.log('4 about prototypes written');
