/*
 * matthewlaujh.com — site behaviour (v3)
 *   dropdown bar · home cursor image ·
 *   project page (random slit-scan, letter rise, plate reveal) ·
 *   all-projects field (parallax, focus, expand-into-page)
 * No dependencies. backdrops.js provides window.MLBackdrops.
 */
(function () {
	'use strict';
	var html = document.documentElement;
	var params = new URLSearchParams(location.search);
	var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var page = html.getAttribute('data-page');

	/* ---------------- dropdown ---------------- */
	function setupDropdown() {
		var btn = document.getElementById('bar_title');
		var dd = document.getElementById('dropdown');
		var scrim = document.getElementById('scrim');
		if (!btn || !dd) return;
		function toggle(open) {
			if (open === undefined) open = !dd.classList.contains('on');
			dd.classList.toggle('on', open);
			if (scrim) scrim.classList.toggle('on', open);
			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
			if (open) {
				var cur = dd.querySelector('a[aria-current]') || dd.querySelector('a');
				if (cur) cur.focus({ preventScroll: true });
			}
		}
		btn.addEventListener('click', function () { toggle(); });
		if (scrim) scrim.addEventListener('click', function () { toggle(false); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
	}

	/* ---------------- backdrop helpers ---------------- */
	function backdropInstance() {
		var el = document.querySelector('.backdrop');
		return el && el.__instance;
	}
	function setBackdropSpeed(s) {
		var inst = backdropInstance();
		if (inst && inst.data) inst.data.speedScale = s;
	}
	/* hand the running diffusion to the next page: it carries on from this
	   snapshot instead of starting over (see Diffuse in backdrops.js) */
	function carryTo(href) {
		var bd = backdropInstance();
		try {
			var snap = bd && bd.snapshot && bd.snapshot();
			if (snap) { snap.slug = href.replace(/\.html$/, '').replace(/^.*\//, ''); sessionStorage.setItem('carry', JSON.stringify(snap)); }
		} catch (x) {}
		location.href = href;
	}
	/* project pages: randomise the slit-scan within a calm band on every load */
	function randomiseBackdrop() {
		var el = document.querySelector('.backdrop[data-random]');
		if (!el) return;
		var sc = el.querySelector('script');
		if (!sc) return;
		var cfg = JSON.parse(sc.textContent);
		var r = function (a, b) { return a + Math.random() * (b - a); };
		cfg.settings.orientation = Math.random() < 0.65 ? 'vertical' : 'horizontal';
		cfg.settings.scan_cycles = Math.round(r(2, 5));
		cfg.settings.scan_cycles_large = 1;
		cfg.settings.scan_size = Math.round(r(70, 100));
		cfg.settings.wiggle = Math.round(r(4, 10));
		cfg.settings.target_speed = Math.round(r(18, 40));
		sc.textContent = JSON.stringify(cfg);
	}

	/* ---------------- diffusion backdrop: cycle the source image on scroll ---------------- */
	function setupDiffuseScroll() {
		var el = document.querySelector('.backdrop[data-backdrop="diffuse"]');
		var inst = el && el.__instance;
		if (!inst || !inst.images || inst.images.length < 2) return;
		var cfg = {};
		try { cfg = JSON.parse(el.querySelector('script').textContent).settings || {}; } catch (e) {}
		if (!cfg.scroll) return;
		var step = Math.max(240, innerHeight * 0.45), last = Math.floor(scrollY / step);
		function onScroll() {
			var k = Math.floor(scrollY / step);
			if (k !== last) { inst.show(inst.index + (k > last ? 1 : -1)); last = k; }
		}
		addEventListener('scroll', onScroll, { passive: true });
		addEventListener('resize', function () { step = Math.max(240, innerHeight * 0.45); });
	}

	/* ease the backdrop speed from `from` to `to` over `ms` (after a short hold at `from`) */
	var settleRaf = null;
	function settle(from, to, ms) {
		if (settleRaf) cancelAnimationFrame(settleRaf);
		setBackdropSpeed(from);
		if (!ms) return;
		var t0 = performance.now(), hold = 500;
		(function step(now) {
			var k = Math.max(0, Math.min(1, (now - t0 - hold) / ms));
			var e = k * k * (3 - 2 * k);
			setBackdropSpeed(from + (to - from) * e);
			if (k < 1) settleRaf = requestAnimationFrame(step); else settleRaf = null;
		})(t0);
	}

	/* ---------------- home: hovered row -> thumb loads, backdrop takes the project ---------------- */
	function setupHome() {
		var links = document.querySelectorAll('.marquee a[data-img]');
		if (!links.length) return;
		var warm = function () { for (var k = 0; k < links.length; k++) { var pre = new Image(); pre.src = links[k].getAttribute('data-img'); } };
		if ('requestIdleCallback' in window) requestIdleCallback(warm); else setTimeout(warm, 800);
		for (var i = 0; i < links.length; i++) (function (a) {
			var item = a.parentNode, thumb = item.querySelector('.thumb');
			function enter() {
				if (thumb && !thumb.src) thumb.src = thumb.getAttribute('data-src');
				var bd = backdropInstance();
				if (bd && bd.show && a.hasAttribute('data-i')) bd.show(+a.getAttribute('data-i'));
				/* a new project: the flow picks up, then settles the longer you stay */
				settle(2.2, 0.7, 2600);
			}
			item.addEventListener('mouseenter', enter);
			a.addEventListener('focus', enter);
			item.addEventListener('mouseleave', function () { settle(1, 1, 0); });
			/* click: the list fades, the flow quickens, and the project page
			   carries the diffusion on from here */
			function go(e) {
				if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
				e.preventDefault();
				var href = this.getAttribute('href'), bd = backdropInstance();
				if (bd && bd.show && a.hasAttribute('data-i')) bd.show(+a.getAttribute('data-i'));
				setBackdropSpeed(2);
				document.documentElement.classList.add('leaving');
				setTimeout(function () { carryTo(href); }, 650);
			}
			a.addEventListener('click', go);
			var more = item.querySelector('.more-in'); if (more) more.addEventListener('click', go);
		})(links[i]);
		addEventListener('pageshow', function (e) { if (e.persisted) document.documentElement.classList.remove('leaving'); });
	}

	/* ---------------- project: plate reveal, slit-scan calms as it's covered ---------------- */
	function setupProject() {
		var figs = document.querySelectorAll('.plates figure');
		if (!figs.length) return;
		if ('IntersectionObserver' in window && !reduced) {
			var io = new IntersectionObserver(function (es) {
				es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
			}, { rootMargin: '0px 0px -15% 0px' });
			for (var i = 0; i < figs.length; i++) io.observe(figs[i]);
		} else {
			for (var j = 0; j < figs.length; j++) figs[j].classList.add('seen');
		}
		var barH = parseFloat(getComputedStyle(html).getPropertyValue('--bar-h')) || 62;
		function glass() {
			setBackdropSpeed(Math.max(0.2, 1 - scrollY / innerHeight));
			html.setAttribute('data-glass', scrollY > innerHeight - barH ? 'light' : 'dark');
		}
		addEventListener('scroll', glass, { passive: true });
		glass();
	}

	/* ---------------- all projects: the field ---------------- */
	function setupField() {
		var f = document.getElementById('field');
		if (!f) return;
		var tiles = [].slice.call(f.querySelectorAll('a'));
		var marks = [].slice.call(f.querySelectorAll('.cluster'));
		var side = [].slice.call(document.querySelectorAll('.field-side a'));
		var mobile = window.matchMedia('(max-width: 800px)');

		/* ---- the map: clusters by category, kind as a drift, no overlaps ---- */
		var cats = (f.getAttribute('data-cats') || '').split('|');
		var centres = [[0.24, 0.42], [0.64, 0.74], [0.74, 0.18]];      // per category, as fractions of the free area
		var drift = { art: [-1, 1], both: [0, 0], design: [1, -1] };
		function layout() {
			if (mobile.matches) { tiles.forEach(function (t) { t.style.cssText = ''; }); return; }
			var seed = 11; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
			var pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || 28;
			var sideEl = document.querySelector('.field-side'), sideW = sideEl ? sideEl.getBoundingClientRect().right : pad;
			var x0 = sideW + 40, x1 = innerWidth - pad, y0 = 80, y1 = innerHeight - 130;
			var W = x1 - x0, H = y1 - y0;
			var tw = Math.max(84, Math.min(190, W * 0.13));                 // tile width scales with the free area
			var nodes = tiles.map(function (t) {
				var ci = Math.max(0, cats.indexOf(t.getAttribute('data-cat'))), c = centres[ci] || [0.5, 0.5];
				var k = t.getAttribute('data-kind') || 'design', d = drift[k] || [0, 0];
				var j = tiles.filter(function (o) { return o.getAttribute('data-cat') === t.getAttribute('data-cat'); }).indexOf(t);
				var ang = j * 2.39996 + rnd() * 0.6, rad = (0.05 + Math.sqrt(j + 1) * 0.07) * Math.min(W, H * 1.3);
				var w = tw * (0.8 + rnd() * 0.45), img = t.querySelector('img');
				var h = w * (img.height && img.width ? img.height / img.width : 0.66);
				return { el: t, ci: ci, cx: x0 + c[0] * W, cy: y0 + c[1] * H,
					x: x0 + c[0] * W + Math.cos(ang) * rad * 1.3 + d[0] * W * 0.03 + (rnd() - 0.5) * 24,
					y: y0 + c[1] * H + Math.sin(ang) * rad * 0.9 + d[1] * H * 0.05 + (rnd() - 0.5) * 24,
					w: w, h: h, z: 0.4 + rnd() * 1.2 };
			});
			/* tiles may overlap, but never by more than ~40% of the smaller one:
			   along one axis they keep at least 60% of its size clear */
			var allow = 0.4;
			for (var it = 0; it < 160; it++) {
				for (var a = 0; a < nodes.length; a++) {
					var A = nodes[a];
					// a soft pull home keeps each cluster together
					A.x += (A.cx - A.x) * 0.004; A.y += (A.cy - A.y) * 0.004;
					for (var b = a + 1; b < nodes.length; b++) {
						var B = nodes[b];
						var dx = B.x - A.x, dy = B.y - A.y;
						var ox = (A.w + B.w) / 2 - allow * Math.min(A.w, B.w) - Math.abs(dx), oy = (A.h + B.h) / 2 - allow * Math.min(A.h, B.h) - Math.abs(dy);
						if (ox <= 0 || oy <= 0) continue;
						if (ox < oy) { var sx = (dx < 0 ? -1 : 1) * ox / 2; A.x -= sx; B.x += sx; }
						else { var sy = (dy < 0 ? -1 : 1) * oy / 2; A.y -= sy; B.y += sy; }
					}
					A.x = Math.max(x0 + A.w / 2, Math.min(x1 - A.w / 2, A.x));
					A.y = Math.max(y0 + A.h / 2, Math.min(y1 - A.h / 2, A.y));
				}
			}
			nodes.forEach(function (n) {
				n.el.style.cssText = 'left:' + n.x.toFixed(1) + 'px;top:' + n.y.toFixed(1) + 'px;width:' + n.w.toFixed(1) + 'px;--z:' + n.z.toFixed(2);
			});
			// cluster labels: above the topmost tile of each cluster, centred on it
			marks.forEach(function (m) {
				var ci = cats.indexOf(m.getAttribute('data-cat')), ns = nodes.filter(function (n) { return n.ci === ci; });
				if (!ns.length) return;
				var mx = ns.reduce(function (s, n) { return s + n.x; }, 0) / ns.length, my = ns.reduce(function (s, n) { return s + n.y; }, 0) / ns.length;
				var dist = function (n) { return Math.hypot(n.x - mx, n.y - my); }, md = ns.reduce(function (s, n) { return s + dist(n); }, 0) / ns.length;
				var core = ns.filter(function (n) { return dist(n) <= md * 1.15; }); if (!core.length) core = ns;
				var top = Math.min.apply(null, core.map(function (n) { return n.y - n.h / 2; }));
				m.style.cssText = 'left:' + mx.toFixed(1) + 'px;top:' + Math.max(50, top - 22).toFixed(1) + 'px';
			});
			f.classList.add('ready');
		}
		layout();
		var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
		var px = 0, py = 0, tx = 0, ty = 0, raf = null;
		function loop() {
			px += (tx - px) * 0.06; py += (ty - py) * 0.06;
			f.style.setProperty('--px', px + 'px'); f.style.setProperty('--py', py + 'px');
			raf = (Math.abs(tx - px) + Math.abs(ty - py) > 0.05) ? requestAnimationFrame(loop) : null;
		}
		if (!reduced) addEventListener('mousemove', function (e) {
			tx = (e.clientX / innerWidth - 0.5) * -40; ty = (e.clientY / innerHeight - 0.5) * -30;
			if (!raf) raf = requestAnimationFrame(loop);
		});
		function focus(i) {
			f.classList.toggle('focus', i >= 0);
			tiles.forEach(function (t) { t.classList.toggle('on', +t.getAttribute('data-i') === i); });
			side.forEach(function (a) { a.classList.toggle('on', +a.getAttribute('data-i') === i); });
		}
		side.forEach(function (a) {
			a.addEventListener('mouseenter', function () { focus(+a.getAttribute('data-i')); });
			a.addEventListener('mouseleave', function () { focus(-1); });
			a.addEventListener('focus', function () { focus(+a.getAttribute('data-i')); });
			a.addEventListener('blur', function () { focus(-1); });
		});
		tiles.forEach(function (t) {
			t.addEventListener('mouseenter', function () { side.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-i') === t.getAttribute('data-i')); }); });
			t.addEventListener('mouseleave', function () { side.forEach(function (a) { a.classList.remove('on'); }); });
		});
		/* click: the field's own diffusion switches to this cover and the tile
		   grows over it, melting into the shader as it goes, so the project page
		   (which opens on the same diffused cover) continues the picture */
		function go(e, el) {
			if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button || mobile.matches) return;
			e.preventDefault();
			var img = el.querySelector('img'), r = img.getBoundingClientRect();
			var d = document.createElement('div');
			d.className = 'flip';
			d.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
			d.innerHTML = '<img src="' + img.src + '" alt="">';
			document.body.appendChild(d);
			var href = el.getAttribute('href');
			var bd = backdropInstance();
			if (bd && bd.show) { bd.settings.fade = 0.7; bd.show(+el.getAttribute('data-i')); setBackdropSpeed(2.2); }
			f.classList.add('leaving');
			var sideEl = document.querySelector('.field-side'); if (sideEl) sideEl.classList.add('leaving');
			if (d.animate) {
				d.animate([
					{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: 1, filter: 'blur(0px)' },
					{ opacity: 1, filter: 'blur(0px)', offset: 0.35 },
					{ left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', opacity: 0, filter: 'blur(14px)' }
				], { duration: 1100, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' }).onfinish = function () { carryTo(href); };
			} else location.href = href;
		}
		addEventListener('pageshow', function (e) {
			if (!e.persisted) return;
			[].forEach.call(document.querySelectorAll('.flip'), function (d) { d.remove(); });
			f.classList.remove('leaving'); var sd = document.querySelector('.field-side'); if (sd) sd.classList.remove('leaving');
		});
		tiles.forEach(function (t) { t.addEventListener('click', function (e) { go(e, t); }); });
		side.forEach(function (a) { a.addEventListener('click', function (e) { go(e, tiles[+a.getAttribute('data-i')]); }); });
	}

	/* ---------------- about: design / art tracks ---------------- */
	function setupAbout() {
		var tabs = document.querySelectorAll('.about .seg [role="tab"]');
		if (!tabs.length) return;
		function show(name, push) {
			for (var i = 0; i < tabs.length; i++) {
				var on = tabs[i].getAttribute('data-track') === name;
				tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
				var panel = document.getElementById('track_' + tabs[i].getAttribute('data-track'));
				if (panel) panel.hidden = !on;
			}
			if (push && history.replaceState) history.replaceState(null, '', name === 'art' ? '#art' : location.pathname);
		}
		for (var i = 0; i < tabs.length; i++) (function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-track'), true); }); })(tabs[i]);
		if (location.hash === '#art') show('art');
		addEventListener('hashchange', function () { show(location.hash === '#art' ? 'art' : 'design'); });
	}

	/* ---------------- custom cursor (pointer devices only) ---------------- */
	function setupCursor() {
		if (!window.matchMedia || !matchMedia('(pointer: fine)').matches || reduced) return;
		var el = document.createElement('div'); el.className = 'cursor'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<i></i><i></i>';
		document.body.appendChild(el);
		var x = -100, y = -100, tx = x, ty = y, raf = null, shown = false;
		function loop() {
			x += (tx - x) * 0.35; y += (ty - y) * 0.35;
			el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
			raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.1) ? requestAnimationFrame(loop) : null;
		}
		function kind(t) {
			if (!t || !t.closest) return '';
			if (t.closest('a, button, [role="button"], summary, label, input, select, textarea')) return 'link';
			if (t.closest('p, li, dd, dt, h1, h2, h3, figcaption, .lede, .role, .org, .note')) return 'text';
			return '';
		}
		document.addEventListener('mousemove', function (e) {
			tx = e.clientX; ty = e.clientY;
			if (!shown) { x = tx; y = ty; shown = true; html.classList.add('has-cursor'); }
			var k = kind(e.target);
			el.classList.toggle('is-link', k === 'link');
			el.classList.toggle('is-text', k === 'text');
			if (!raf) raf = requestAnimationFrame(loop);
		}, { passive: true });
		document.addEventListener('mousedown', function () { el.classList.add('is-down'); });
		document.addEventListener('mouseup', function () { el.classList.remove('is-down'); });
		document.addEventListener('mouseleave', function () { el.classList.add('is-hidden'); });
		document.addEventListener('mouseenter', function () { el.classList.remove('is-hidden'); });
		/* touch after mouse: give the native cursor back */
		addEventListener('touchstart', function () { html.classList.remove('has-cursor'); }, { passive: true });
	}

	/* ---------------- widow / orphan fallback ---------------- */
	function fixWidows() {
		if (CSS.supports && CSS.supports('text-wrap', 'pretty')) return;
		var nodes = document.querySelectorAll('.prose p, .prose li');
		for (var i = 0; i < nodes.length; i++) {
			var el = nodes[i], last = el.lastChild;
			while (last && last.nodeType === 1 && last.lastChild) last = last.lastChild;
			if (!last || last.nodeType !== 3) continue;
			var txt = last.nodeValue;
			if (txt.split(' ').length < 4) continue;
			last.nodeValue = txt.replace(/ ([^ ]+)\s*$/, ' $1');
		}
	}

	/* ---------------- init ---------------- */
	function init() {
		setupDropdown();
		fixWidows();
		randomiseBackdrop();
		if (window.MLBackdrops) window.MLBackdrops.init(document);
		setupDiffuseScroll();
		setupCursor();
		if (page === 'home') setupHome();
		if (page === 'project') setupProject();
		if (page === 'field') setupField();
		if (page === 'about') { html.setAttribute('data-glass', 'light'); setupAbout(); }
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
