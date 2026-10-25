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

	/* listeners that belong to the current page: dropped on every swap */
	var pageAC = null;
	var popSeq = 0;   // bumped on every Back/Forward, so a delayed click never overtakes one
	function on(target, ev, fn, opts) {
		opts = Object.assign({}, opts || {}, pageAC ? { signal: pageAC.signal } : {});
		target.addEventListener(ev, fn, opts);
	}

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
				/* the panel is visibility:hidden until its transition ends: focus after it */
				var cur = dd.querySelector('a[aria-current]') || dd.querySelector('a');
				if (cur) setTimeout(function () { if (dd.classList.contains('on')) cur.focus({ preventScroll: true }); }, 320);
			} else if (dd.contains(document.activeElement)) btn.focus({ preventScroll: true });
		}
		btn.addEventListener('click', function () { toggle(); });
		if (scrim) scrim.addEventListener('click', function () { toggle(false); });
		on(document, 'keydown', function (e) { if (e.key === 'Escape' && dd.classList.contains('on')) toggle(false); });
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
		on(window, 'scroll', onScroll, { passive: true });
		on(window, 'resize', function () { step = Math.max(240, innerHeight * 0.45); });
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
		/* once the list scrolls under the bar, the name floats as a pill */
		function scrolled() { if (scrollY > 6) html.setAttribute('data-scrolled', '1'); else html.removeAttribute('data-scrolled'); }
		on(window, 'scroll', scrolled, { passive: true }); scrolled();
		/* the list arrives as a cascade: each row a beat after the last */
		var rows = document.querySelectorAll('.marquee > *');
		for (var r = 0; r < rows.length; r++) rows[r].style.setProperty('--i', r);
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
			a.addEventListener('mouseenter', enter);
			var panel = item.querySelector('.more'); if (panel) panel.addEventListener('mouseenter', enter);
			a.addEventListener('focus', enter);
			item.addEventListener('mouseleave', function () { settle(1, 1, 0); });
			/* click: the list fades, the flow quickens, and the project page
			   carries the diffusion on from here */
			function go(e) {
				if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
				e.preventDefault();
				var href = a.getAttribute('href'), bd = backdropInstance();
				if (reduced) { navigate(href); return; }
				if (bd && bd.show && a.hasAttribute('data-i')) bd.show(+a.getAttribute('data-i'));
				setBackdropSpeed(2);
				document.documentElement.classList.add('leaving');
				var seq = popSeq;
				setTimeout(function () { if (popSeq === seq) navigate(href); }, 650);
			}
			a.addEventListener('click', go);
			var more = item.querySelector('.more-in'); if (more) more.addEventListener('click', go);
		})(links[i]);
	}

	/* ---------------- project: plate reveal, slit-scan calms as it's covered ---------------- */
	function setupProject() {
		/* phones: one column — meta and intro, the first plate, then prose with a
		   plate after every second paragraph and whatever is left at the end.
		   Widen the window (or turn a tablet) and the plates go back to their column. */
		var narrow = window.matchMedia('(max-width: 800px)');
		var plates = document.querySelector('.plates'), text = document.querySelector('.project .text'), prose = document.querySelector('.project .prose');
		var plateList = plates ? [].slice.call(plates.children) : [];
		function reflow() {
			if (!plateList.length || !text || !prose) return;
			if (narrow.matches) {
				if (!plates.parentNode) return;
				var fl = plateList.slice();
				var first = fl.shift(); first.classList.add('lead'); text.insertBefore(first, prose);
				var ps = [].slice.call(prose.children).filter(function (n) { return n.tagName === 'P' && n.textContent.length > 140; });   // real paragraphs, not link lines
				for (var pi = 1, fi = 0; pi < ps.length && fi < fl.length; pi += 2, fi++) ps[pi].insertAdjacentElement('afterend', fl[fi]);
				while (fl.length && fi < fl.length) prose.appendChild(fl[fi++]);
				plates.remove();
			} else if (!plates.parentNode) {
				plateList.forEach(function (f) { f.classList.remove('lead'); plates.appendChild(f); });
				text.parentNode.appendChild(plates);
			}
		}
		reflow();
		on(narrow, 'change', reflow);
		var figs = document.querySelectorAll('.project figure');
		if (!figs.length) return;
		/* videos load and play only while near the viewport. Each has a pause pill,
		   and a pause there sticks until the visitor plays it again. Under reduced
		   motion nothing plays by itself: the poster waits with a play control. */
		var vids = [].slice.call(document.querySelectorAll('.project figure video'));
		function play(v) { if (v.getAttribute('data-stopped') || reduced) return; if (v.preload === 'none') v.preload = 'auto'; v.play && v.play().catch(function () {}); }
		vids.forEach(function (v) {
			var fig = v.closest('figure'), btn = fig && fig.querySelector('.vctl');
			if (reduced) { v.removeAttribute('autoplay'); v.pause(); v.setAttribute('data-stopped', '1'); }
			function reflect() {
				var stopped = v.paused && !!v.getAttribute('data-stopped');
				if (fig) fig.classList.toggle('stopped', stopped);
				if (btn) btn.setAttribute('aria-label', stopped ? 'Play video' : 'Pause video');
			}
			v.addEventListener('play', reflect); v.addEventListener('pause', reflect);
			if (btn) btn.addEventListener('click', function () {
				if (v.getAttribute('data-stopped')) { v.removeAttribute('data-stopped'); if (v.preload === 'none') v.preload = 'auto'; v.play && v.play().catch(function () {}); }
				else { v.setAttribute('data-stopped', '1'); v.pause(); }
				reflect();
			});
			reflect();
		});
		if ('IntersectionObserver' in window) {
			var vo = new IntersectionObserver(function (es) {
				es.forEach(function (e) {
					var v = e.target;
					if (e.isIntersecting) play(v);
					else if (!v.paused) v.pause();
				});
			}, { rootMargin: '40% 0px' });
			vids.forEach(function (v) { vo.observe(v); });
		} else vids.forEach(play);
		if ('IntersectionObserver' in window && !reduced) {
			var io = new IntersectionObserver(function (es) {
				es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
			}, { rootMargin: '0px 0px -15% 0px' });
			for (var i = 0; i < figs.length; i++) io.observe(figs[i]);
		} else {
			for (var j = 0; j < figs.length; j++) figs[j].classList.add('seen');
		}
		var barH = parseFloat(getComputedStyle(html).getPropertyValue('--bar-h')) || 62;
		var wasLight = false;
		function glass() {
			setBackdropSpeed(Math.max(0.2, 1 - scrollY / innerHeight));
			var light = scrollY > innerHeight - barH;
			html.setAttribute('data-glass', light ? 'light' : 'dark');
			if (light !== wasLight) { wasLight = light; var bd = backdropInstance(); if (bd) { if (light) { if (bd.pause) setTimeout(function () { if (wasLight) bd.pause(); }, 700); } else if (bd.start) bd.start(); } }
		}
		on(window, 'scroll', glass, { passive: true });
		glass();
	}

	/* ---------------- all projects: the field ---------------- */
	function setupField() {
		var f = document.getElementById('field');
		if (!f) return;
		var tiles = [].slice.call(f.querySelectorAll('a'));
		var marks = [].slice.call(f.querySelectorAll('.cluster'));
		var side = [].slice.call(document.querySelectorAll('.field-time a'));
		var mobile = window.matchMedia('(max-width: 1100px)');
		/* the full timeline only where it fits with no cut-off titles and no scrolling:
		   full HD and up, or 1680 wide with 1100 of height. Everywhere else the lanes
		   fold under the axis and the map takes the height. */
		var full = window.matchMedia('(min-width: 1920px) and (min-height: 1080px), (min-width: 1680px) and (min-height: 1100px)');
		var timeEl = document.querySelector('.field-time'), yrsBtn = timeEl && timeEl.querySelector('.yrs');
		var px = 0, py = 0, tx = 0, ty = 0, raf = null;
		var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'links'); svg.setAttribute('aria-hidden', 'true');
		f.insertBefore(svg, f.firstChild);
		var edges = [];
		function drawEdges() {
			for (var i = 0; i < edges.length; i++) {
				var e = edges[i];
				e.el.setAttribute('x1', e.a.x + px * e.a.z); e.el.setAttribute('y1', e.a.y + py * e.a.z);
				e.el.setAttribute('x2', e.b.x + px * e.b.z); e.el.setAttribute('y2', e.b.y + py * e.b.z);
			}
		}

		/* ---- the map: clusters by category, kind as a drift, no overlaps ---- */
		var cats = (f.getAttribute('data-cats') || '').split('|');
		var centres = [[0.2, 0.4], [0.55, 0.72], [0.82, 0.22]];      // per category, as fractions of the free area
		var drift = { art: [-1, 1], both: [0, 0], design: [1, -1] };
		function layout() {
			if (mobile.matches) { tiles.forEach(function (t) { t.style.cssText = ''; }); html.classList.remove('field-tall'); html.classList.remove('field-collapsed'); f.style.height = ''; return; }
			var seed = 11; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
			var pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || 28;
			var collapsed = !full.matches;
			html.classList.toggle('field-collapsed', collapsed);
			if (!collapsed && timeEl) { timeEl.classList.remove('open'); if (yrsBtn) yrsBtn.setAttribute('aria-expanded', 'false'); }
			var timeB = timeEl ? (collapsed ? timeEl.querySelector('.axis') : timeEl).getBoundingClientRect().bottom : 80;
			/* a short window (a laptop with the timeline open) gets a taller field
			   than the viewport and scrolls, rather than hiding tiles under each other */
			var x0 = pad + 20, x1 = innerWidth - pad - 20, y0 = timeB + 50, y1 = Math.max(innerHeight - 140, y0 + (collapsed ? 400 : 470));
			var tall = y1 > innerHeight - 140;
			html.classList.toggle('field-tall', tall);
			f.style.height = tall ? (y1 + 110) + 'px' : '';
			var W = x1 - x0, H = y1 - y0;
			var tw = Math.max(84, Math.min(190, W * 0.11));                 // tile width scales with the free area
			var years = tiles.map(function (t) { return +t.getAttribute('data-year') || 0; });
			var ymin = Math.min.apply(null, years), ymax = Math.max.apply(null, years);
			var nodes = tiles.map(function (t) {
				var ci = Math.max(0, cats.indexOf(t.getAttribute('data-cat'))), c = centres[ci] || [0.5, 0.5];
				var k = t.getAttribute('data-kind') || 'design', d = drift[k] || [0, 0];
				var j = tiles.filter(function (o) { return o.getAttribute('data-cat') === t.getAttribute('data-cat'); }).indexOf(t);
				var ang = j * 2.39996 + rnd() * 0.6, rad = (0.05 + Math.sqrt(j + 1) * 0.07) * Math.min(W, H * 1.3);
				var rec = ymax > ymin ? ((+t.getAttribute('data-year') || ymin) - ymin) / (ymax - ymin) : 1;   // 0 oldest .. 1 newest
				var w = tw * (0.7 + rec * 0.6 + rnd() * 0.15), img = t.querySelector('img');
				// the cover's true shape comes from its width/height attributes: the image itself may not have loaded yet
				var iw = +img.getAttribute('width') || img.naturalWidth, ih = +img.getAttribute('height') || img.naturalHeight;
				var h = w * (iw && ih ? ih / iw : 0.66);
				return { el: t, ci: ci, rec: rec, cx: x0 + c[0] * W, cy: y0 + c[1] * H,
					x: x0 + c[0] * W + Math.cos(ang) * rad * 1.3 + d[0] * W * 0.03 + (rnd() - 0.5) * 24,
					y: y0 + c[1] * H + Math.sin(ang) * rad * 0.9 + d[1] * H * 0.05 + (rnd() - 0.5) * 24,
					w: w, h: h, z: 0.4 + rnd() * 1.2 };
			});
			/* tiles may overlap, but never by more than ~25% of the smaller one:
			   along one axis they keep at least 75% of its size clear, so every
			   tile shows enough of itself to be seen and clicked */
			var allow = 0.25;
			/* two phases: clusters pull together while overlaps are pushed apart, then
			   a settling pass with no pull, so the overlap rule actually holds at the end */
			for (var it = 0; it < 320; it++) {
				var pull = it < 200 ? 0.004 : 0;
				for (var a = 0; a < nodes.length; a++) {
					var A = nodes[a];
					// a soft pull home keeps each cluster together
					A.x += (A.cx - A.x) * pull; A.y += (A.cy - A.y) * pull;
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
				n.el.style.cssText = 'left:' + n.x.toFixed(1) + 'px;top:' + n.y.toFixed(1) + 'px;width:' + n.w.toFixed(1) + 'px;--z:' + n.z.toFixed(2) + ';z-index:' + (1 + Math.round(n.rec * 10));
			});
			/* the graph: each tile joins its two nearest neighbours in its cluster,
			   and each pair of clusters is bridged once at its closest point */
			svg.setAttribute('viewBox', '0 0 ' + innerWidth + ' ' + (tall ? y1 + 110 : innerHeight));
			while (svg.firstChild) svg.removeChild(svg.firstChild);
			edges = [];
			var seen = {};
			function link(a, b, bridge) {
				var key = Math.min(a.i, b.i) + '-' + Math.max(a.i, b.i);
				if (seen[key]) return; seen[key] = 1;
				var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				if (bridge) l.setAttribute('class', 'bridge');
				svg.appendChild(l); edges.push({ a: a, b: b, el: l });
			}
			var d2 = function (a, b) { return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y); };
			nodes.forEach(function (n, i) { n.i = i; });
			nodes.forEach(function (n) {
				nodes.filter(function (o) { return o !== n && o.ci === n.ci; })
					.sort(function (p, q) { return d2(n, p) - d2(n, q); }).slice(0, 2)
					.forEach(function (o) { link(n, o); });
			});
			for (var c1 = 0; c1 < cats.length; c1++) for (var c2 = c1 + 1; c2 < cats.length; c2++) {
				var best = null;
				nodes.forEach(function (n) { if (n.ci !== c1) return; nodes.forEach(function (o) { if (o.ci !== c2) return; var d = d2(n, o); if (!best || d < best.d) best = { d: d, a: n, b: o }; }); });
				if (best) link(best.a, best.b, true);
			}
			drawEdges();
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
		/* back from a project: its cover shrinks from the whole screen into its tile,
		   the reverse of the way it left */
		if (cameFrom && !reduced && !mobile.matches) (function () {
			var tile = tiles.filter(function (t) { return slugOf(t.getAttribute('href')) === cameFrom; })[0];
			cameFrom = null;
			if (!tile) return;
			var img = tile.querySelector('img'), bd = backdropInstance();
			if (bd && bd.show) bd.show(+tile.getAttribute('data-i'));
			var d = document.createElement('div');
			d.className = 'flip';
			d.innerHTML = '<img src="' + img.src + '" alt="">';
			document.body.appendChild(d);
			tile.style.transition = 'none'; tile.style.opacity = '0';
			var settled = false;
			function settleTile() { if (settled) return; settled = true; d.remove(); tile.style.transition = ''; tile.style.opacity = ''; }
			if (!d.animate) { settleTile(); return; }
			setTimeout(settleTile, 1400);
			requestAnimationFrame(function () {
				if (settled) return;
				var r = img.getBoundingClientRect();
				d.animate([
					{ left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', opacity: 0, filter: 'blur(14px)' },
					{ opacity: 1, filter: 'blur(0px)', offset: 0.55 },
					{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: 1, filter: 'blur(0px)' }
				], { duration: 1000, easing: 'cubic-bezier(.2,.6,.2,1)', fill: 'forwards' }).onfinish = settleTile;
			});
		})();
		var rt; on(window, 'resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
		on(mobile, 'change', function () { clearTimeout(rt); layout(); });   // across the grid/field line: no debounce, no empty field
		on(full, 'change', function () { clearTimeout(rt); layout(); });
		/* the folded lanes: open from the pill (click, keyboard) or by resting on the axis */
		if (timeEl && yrsBtn) {
			function setOpen(o) { timeEl.classList.toggle('open', o); yrsBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
			yrsBtn.addEventListener('click', function () { setOpen(!timeEl.classList.contains('open')); });
			var hoverT;
			timeEl.addEventListener('mouseover', function () { if (!html.classList.contains('field-collapsed')) return; clearTimeout(hoverT); hoverT = setTimeout(function () { setOpen(true); }, 350); });
			timeEl.addEventListener('mouseout', function (e) { if (!html.classList.contains('field-collapsed') || (e.relatedTarget && timeEl.contains(e.relatedTarget))) return; clearTimeout(hoverT); hoverT = setTimeout(function () { setOpen(false); }, 250); });
			on(document, 'keydown', function (e) { if (e.key === 'Escape' && timeEl.classList.contains('open')) { setOpen(false); yrsBtn.focus(); } });
			on(document, 'click', function (e) { if (timeEl.classList.contains('open') && !timeEl.contains(e.target)) setOpen(false); });
		}
		function scrolled() { if (scrollY > 6) html.setAttribute('data-scrolled', '1'); else html.removeAttribute('data-scrolled'); }
		on(window, 'scroll', scrolled, { passive: true });
		function loop() {
			px += (tx - px) * 0.06; py += (ty - py) * 0.06;
			f.style.setProperty('--px', px + 'px'); f.style.setProperty('--py', py + 'px');
			drawEdges();
			raf = (Math.abs(tx - px) + Math.abs(ty - py) > 0.05) ? requestAnimationFrame(loop) : null;
		}
		if (!reduced) on(window, 'mousemove', function (e) {
			tx = (e.clientX / innerWidth - 0.5) * -40; ty = (e.clientY / innerHeight - 0.5) * -30;
			if (!raf) raf = requestAnimationFrame(loop);
		});
		/* the backdrop takes whichever project is under the cursor, as on the home list */
		function showBackdrop(i) {
			var bd = backdropInstance();
			if (bd && bd.show && i >= 0) { bd.show(i); settle(2.2, 0.7, 2600); }
			else if (i < 0) settle(1, 1, 0);
		}
		function focus(i) {
			f.classList.toggle('focus', i >= 0);
			tiles.forEach(function (t) { t.classList.toggle('on', +t.getAttribute('data-i') === i); });
			side.forEach(function (a) { a.classList.toggle('on', +a.getAttribute('data-i') === i); });
			showBackdrop(i);
		}
		side.forEach(function (a) {
			a.addEventListener('mouseenter', function () { focus(+a.getAttribute('data-i')); });
			a.addEventListener('mouseleave', function () { focus(-1); });
			a.addEventListener('focus', function () { focus(+a.getAttribute('data-i')); });
			a.addEventListener('blur', function () { focus(-1); });
		});
		tiles.forEach(function (t) {
			t.addEventListener('mouseenter', function () { side.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-i') === t.getAttribute('data-i')); }); edges.forEach(function (e) { e.el.classList.toggle('on', e.a.el === t || e.b.el === t); }); showBackdrop(+t.getAttribute('data-i')); });
			t.addEventListener('mouseleave', function () { side.forEach(function (a) { a.classList.remove('on'); }); edges.forEach(function (e) { e.el.classList.remove('on'); }); showBackdrop(-1); });
		});
		/* click: the field's own diffusion switches to this cover and the tile
		   grows over it, melting into the shader as it goes, so the project page
		   (which opens on the same diffused cover) continues the picture */
		function go(e, el) {
			if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button || mobile.matches || e.defaultPrevented) return;
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
			var sideEl = document.querySelector('.field-time'); if (sideEl) sideEl.classList.add('leaving');
			var seq = popSeq, gone = false;
			function arrive() { if (gone) return; gone = true; d.remove(); if (popSeq === seq) navigate(href); }
			if (d.animate) {
				setTimeout(arrive, 1300);
				d.animate([
					{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: 1, filter: 'blur(0px)' },
					{ opacity: 1, filter: 'blur(0px)', offset: 0.35 },
					{ left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', opacity: 0, filter: 'blur(14px)' }
				], { duration: 1100, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' }).onfinish = arrive;
			} else navigate(href);
		}
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
		on(window, 'hashchange', function () { show(location.hash === '#art' ? 'art' : 'design'); });
	}

	/* ---------------- custom cursor (pointer devices only) ---------------- */
	function setupCursor() {
		if (!window.matchMedia || !matchMedia('(pointer: fine)').matches || reduced) return;
		/* two layers: a faint unblended halo underneath, so the difference-blended
		   lines still read over mid-grey, where white minus grey is grey */
		var halo = document.createElement('div'); halo.className = 'cursor cursor-halo'; halo.setAttribute('aria-hidden', 'true'); halo.innerHTML = '<i></i><i></i>';
		var el = document.createElement('div'); el.className = 'cursor'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<i></i><i></i>';
		document.body.appendChild(halo); document.body.appendChild(el);
		function cls(name, on) { el.classList.toggle(name, on); halo.classList.toggle(name, on); }
		/* the crosshair sits exactly under the pointer: the position is written in the
		   event itself (no frame of delay), from pointerrawupdate where the browser
		   offers it, which arrives at the hardware rate rather than once a frame */
		var shown = false, lastTarget = null;
		function place(e) {
			var t = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
			el.style.transform = t; halo.style.transform = t;
			/* a touch hands the native cursor back; the next mouse move takes it again */
			if (!shown || !html.classList.contains('has-cursor')) { shown = true; html.classList.add('has-cursor'); }
		}
		function kind(t) {
			if (!t || !t.closest) return '';
			if (t.closest('a, button, [role="button"], .more-in, summary, label, input, select, textarea')) return 'link';
			if (t.closest('p, li, dd, dt, h1, h2, h3, figcaption, .lede, .role, .org, .note')) return 'text';
			return '';
		}
		function classify(e) {
			if (e.target === lastTarget) return;
			lastTarget = e.target;
			var k = kind(e.target);
			cls('is-link', k === 'link');
			cls('is-text', k === 'text');
		}
		if ('onpointerrawupdate' in window) {
			document.addEventListener('pointerrawupdate', function (e) { if (e.pointerType === 'mouse') place(e); }, { passive: true });
			document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { place(e); classify(e); } }, { passive: true });
		} else {
			document.addEventListener('mousemove', function (e) { place(e); classify(e); }, { passive: true });
		}
		document.addEventListener('mousedown', function () { cls('is-down', true); });
		/* a native drag swallows mouseup, so every way a press can end clears the pressed shape */
		['mouseup', 'pointerup', 'pointercancel', 'dragend', 'blur'].forEach(function (t) { addEventListener(t, function () { cls('is-down', false); }, true); });
		/* links and images do not start a native drag (which would freeze the crosshair and show the OS drag cursor) */
		document.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('a, img, video, .more-in')) e.preventDefault(); });
		document.addEventListener('mouseleave', function () { cls('is-hidden', true); });
		document.addEventListener('mouseenter', function () { cls('is-hidden', false); });
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

	/* ---------------- per-page setup ---------------- */
	function setupPage() {
		if (pageAC) pageAC.abort();
		pageAC = typeof AbortController !== 'undefined' ? new AbortController() : null;
		page = html.getAttribute('data-page');
		setupDropdown();
		fixWidows();
		setupDiffuseScroll();
		if (page === 'home') setupHome();
		if (page === 'project') setupProject();
		if (page === 'field') setupField();
		if (page === 'about') { html.setAttribute('data-glass', 'light'); setupAbout(); }
	}

	/* ---------------- navigation: one renderer, pages swapped underneath ----------------
	   The diffusion canvas never reloads. A click fetches the next page, the current
	   one plays its leave, then bar + main are swapped and the backdrop is pointed
	   at the new page's images (a crossfade, not a restart). */
	/* one navigation at a time: a newer click, or Back, replaces whatever is in
	   flight (its fetch is aborted and it never pushes a history entry) */
	var current = null;
	var cameFrom = null;   // the project slug we just left, for the field's reverse flip
	function slugOf(href) { return String(href).replace(/[?#].*$/, '').replace(/\.html$/, '').replace(/\/$/, '').split('/').pop(); }
	var pageSlug = slugOf(location.pathname);
	function kindOf(href) {
		var m = href.replace(/[?#].*$/, '').replace(/\.html$/, '').split('/').pop();
		return m === 'About' ? 'about' : m === 'All-Projects' ? 'field' : (m === '' || m === 'index' || m === 'Front-Page' || m === '404') ? 'home' : 'project';
	}
	function navigate(href, opts) {
		opts = opts || {};
		if (current && current.ac) current.ac.abort();
		var nav = { href: href, ac: typeof AbortController !== 'undefined' ? new AbortController() : null };
		current = nav;
		var to = kindOf(href), leaving = leave(to, href);
		fetch(href, { credentials: 'same-origin', signal: nav.ac && nav.ac.signal }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
			.then(function (text) {
				if (current !== nav) return null;
				var doc = new DOMParser().parseFromString(text, 'text/html');
				if (!doc.documentElement.getAttribute('data-page') || !doc.body.querySelector('main')) throw new Error('not a site page');
				/* a page from a newer build than the stylesheet and scripts in memory: load it properly */
				var mine = document.querySelector('meta[name="build"]'), theirs = doc.querySelector('meta[name="build"]');
				if (mine && theirs && mine.content !== theirs.content) throw new Error('new build');
				/* the backdrop moves first: it is already the next page's by the time the text arrives */
				retarget(doc.body.querySelector('.backdrop'), true);
				return leaving.then(function () { return doc; });
			})
			.then(function (doc) {
				if (!doc || current !== nav) return;
				if (!opts.pop) { try { history.pushState({ ml: 1 }, '', href); } catch (x) {} }
				current = null;
				swap(doc);
			})
			.catch(function (e) {
				if (e && e.name === 'AbortError') return;
				if (current === nav) location.href = href;
			});
	}
	/* the backdrop takes the project being opened, whether by a click or by the
	   browser's Forward: the list page's own link to it knows the image index */
	function preview(href) {
		var bd = backdropInstance();
		if (!bd || !bd.show) return;
		var path; try { path = new URL(href, location.href).pathname; } catch (x) { return; }
		var links = document.querySelectorAll('a[data-i][href]');
		for (var k = 0; k < links.length; k++) if (links[k].pathname === path) { bd.show(+links[k].getAttribute('data-i')); setBackdropSpeed(2); return; }
	}
	/* the current page's exit, as a promise */
	function leave(to, href) {
		var ms = 0;
		html.setAttribute('data-to', to);
		var dd = document.getElementById('dropdown'), sc = document.getElementById('scrim');
		if (dd) dd.classList.remove('on'); if (sc) sc.classList.remove('on');
		var fresh = !html.classList.contains('leaving');
		html.classList.add('leaving');
		if (page === 'home') { if (fresh) ms = 500; }
		else if (page === 'project' || page === 'about') ms = to === 'project' ? 900 : 500;
		else if (page === 'field') { var f = document.getElementById('field'); if (f && !f.classList.contains('leaving')) { f.classList.add('leaving'); ms = 500; } }
		if (to === 'project' && (page === 'home' || page === 'field') && href) preview(href);
		if (to === 'home' && page !== 'home') ms = Math.max(ms, 1250);   // the capsule folds away at the pace it arrived
		/* to or from the white page: let the background cross over first */
		if (to === 'about' || page === 'about') {
			ms = Math.max(ms, 950);
			var bd = document.querySelector('.backdrop'); if (bd && to === 'about') bd.classList.add('off');
		}
		if (reduced) ms = 0;   // nothing animates, so nothing to wait for
		return new Promise(function (res) { setTimeout(res, ms); });
	}
	function swap(doc) {
		var nb = doc.body, kind = doc.documentElement.getAttribute('data-page');
		cameFrom = page === 'project' ? pageSlug : null;
		pageSlug = slugOf((doc.querySelector('link[rel="canonical"]') || {}).href || '');
		document.title = doc.title;
		html.setAttribute('data-from', page);
		html.removeAttribute('data-to');
		html.setAttribute('data-page', kind);
		html.removeAttribute('data-glass');
		html.removeAttribute('data-scrolled');
		html.classList.remove('leaving');
		// drop everything page-specific; keep the renderer, veil, footer and cursor
		[].slice.call(document.body.children).forEach(function (el) {
			if (el.matches('.backdrop, .veil, .site-footer, .cursor, .skip, .announce')) return;
			el.remove();
		});
		var footer = document.querySelector('.site-footer');
		[].slice.call(nb.children).forEach(function (el) {
			if (el.matches('.backdrop, .poster, .veil, .site-footer, .skip, script')) return;
			document.body.insertBefore(document.importNode(el, true), footer);
		});
		// the veil follows the page (dark on home / field, lighter on a project)
		var veil = document.querySelector('.veil'), nveil = nb.querySelector('.veil');
		if (veil && nveil) veil.className = nveil.className;
		scrollTo(0, 0);
		html.classList.remove('field-tall'); html.classList.remove('field-collapsed');
		setupPage();
		/* a page change the way a full load would be: focus at the top, the title read out */
		var main = document.getElementById('main');
		if (main) main.focus({ preventScroll: true });
		var live = document.querySelector('.announce');
		if (live) { live.textContent = ''; setTimeout(function () { live.textContent = doc.title; }, 50); }
	}
	/* point the running diffusion at the next page's images */
	function retarget(nel, early) {
		var el = document.querySelector('.backdrop');
		if (!nel) { if (el) { el.classList.add('off'); var i0 = el.__instance; setTimeout(function () { if (el.classList.contains('off')) { el.classList.add('gone'); if (i0 && i0.pause) i0.pause(); } }, 1200); } return; }
		var cfg = {};
		try { cfg = JSON.parse(nel.querySelector('script').textContent); } catch (e) {}
		if (!el) {                                   // came from a page without one
			var np = nel.parentNode.querySelector('.poster');
			if (np) document.body.insertBefore(document.importNode(np, true), document.body.firstChild);
			document.body.insertBefore(document.importNode(nel, true), document.body.firstChild);
			if (window.MLBackdrops) window.MLBackdrops.init(document);
			return;
		}
		el.classList.remove('off'); el.classList.remove('gone');
		var sc = el.querySelector('script'); if (sc) sc.textContent = JSON.stringify(cfg);
		var inst = el.__instance;
		if (inst && inst.retarget) {
			var s = Object.assign({}, cfg.settings || {});
			if (early) s.fade = Math.min(s.fade || 2, 0.9);    // quick enough to land before the text
			inst.retarget(cfg.images || [], s); inst.start();
			if (early) setTimeout(function () { inst.settings.fade = (cfg.settings || {}).fade || 2; }, 1500);
		}
	}
	function setupNav() {
		if (!window.fetch || !window.DOMParser || !history.pushState) return;
		document.addEventListener('click', function (e) {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
			var a = e.target.closest && e.target.closest('a[href]');
			if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
			var href = a.getAttribute('href');
			if (!href || href[0] === '#' || /^mailto:/.test(href) || /\.(pdf|zip|jpg|png|webp|mp4|webm)$/i.test(a.pathname)) return;
			if (a.pathname === location.pathname && a.hash) return;
			e.preventDefault();
			navigate(a.href);
		});
		addEventListener('popstate', function () { popSeq++; navigate(location.href, { pop: true }); });
		try { history.replaceState({ ml: 1 }, '', location.href); } catch (x) {}
	}

	/* ---------------- init ---------------- */
	/* the workers.dev / pages.dev copies are for testing: keep them out of search */
	if (/\.(workers|pages)\.dev$/.test(location.hostname)) {
		var robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement('meta'));
		robots.setAttribute('name', 'robots'); robots.setAttribute('content', 'noindex, nofollow');
	}
	/* ---------------- the tab icon: a gradient in a project's colours, new on every load ----------------
	   Each cover contributed three colours at build time. A load picks a project,
	   takes two of its colours, lifts them into a soft range so the tile stays
	   light and legible at 16px, and draws a rounded square with a gradient
	   between them at a random angle. It drifts slowly while the tab is open. */
	function setupFavicon() {
		var link = document.getElementById('icon_svg'), data = document.getElementById('palettes');
		if (!link || !data) return;
		var sets; try { sets = JSON.parse(data.textContent); } catch (e) { return; }
		if (!sets || !sets.length) return;
		var N = 96, c = document.createElement('canvas'); c.width = c.height = N;
		var x = c.getContext('2d');
		function hsl(hex) {   // #rrggbb -> [h, s, l]
			var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
			var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
			if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
				h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
			return [h, s, l];
		}
		function soft(hex, k) {   // the project's hue, in the tile's light, slightly milky range
			var v = hsl(hex), s = Math.min(0.55, Math.max(0.18, v[1] * 0.9)), l = 0.58 + k * 0.22;
			if (v[1] < 0.08) s = 0.04;                                   // a grey cover stays grey
			return 'hsl(' + Math.round(v[0] * 360) + ',' + Math.round(s * 100) + '%,' + Math.round(l * 100) + '%)';
		}
		var pal = sets[Math.floor(Math.random() * sets.length)].slice();
		var a = pal.splice(Math.floor(Math.random() * pal.length), 1)[0], b = pal[Math.floor(Math.random() * pal.length)];
		var ang = Math.random() * Math.PI * 2, drift = 0;
		function paint() {
			var cx = N / 2, cy = N / 2, dx = Math.cos(ang + drift) * N * 0.6, dy = Math.sin(ang + drift) * N * 0.6;
			var g = x.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
			g.addColorStop(0, soft(a, 1)); g.addColorStop(1, soft(b, 0));
			x.clearRect(0, 0, N, N);
			var r = N * 0.22; x.beginPath();
			x.moveTo(r, 0); x.arcTo(N, 0, N, N, r); x.arcTo(N, N, 0, N, r); x.arcTo(0, N, 0, 0, r); x.arcTo(0, 0, N, 0, r); x.closePath();
			x.fillStyle = g; x.fill();
			link.href = c.toDataURL('image/png');
		}
		paint();
		var tick = setInterval(function () { if (document.hidden) return; drift += 0.06; paint(); if (drift > Math.PI) clearInterval(tick); }, 4000);
	}
	function init() {
		var live = document.createElement('div'); live.className = 'visually-hidden announce'; live.setAttribute('aria-live', 'polite'); document.body.appendChild(live);
		randomiseBackdrop();
		setupFavicon();
		if (window.MLBackdrops) window.MLBackdrops.init(document);
		setupCursor();
		setupNav();
		setupPage();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
