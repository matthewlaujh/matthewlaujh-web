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

	/* ---------------- home: cover follows the cursor over a title ---------------- */
	function setupHome() {
		var c = document.getElementById('cursor_image');
		if (!c) return;
		var im = c.querySelector('img'), cap = c.querySelector('.cap');
		var mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my, vx = 0, vy = 0, raf = null;
		addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(loop); });
		function loop() {
			raf = null;
			var nx = x + (mx - x) * 0.12, ny = y + (my - y) * 0.12;
			vx = nx - x; vy = ny - y; x = nx; y = ny;
			var w = c.offsetWidth, h = c.offsetHeight;
			var px = Math.min(x + 24, innerWidth - w - 24), py = Math.min(y + 24, innerHeight - h - 40);
			c.style.transform = 'translate(' + px + 'px,' + py + 'px) rotate(' + Math.max(-6, Math.min(6, vx * 0.25)) + 'deg) skewY(' + Math.max(-4, Math.min(4, vy * 0.15)) + 'deg)';
			if (c.classList.contains('on') || Math.abs(mx - x) + Math.abs(my - y) > 0.5) raf = requestAnimationFrame(loop);
		}
		var links = document.querySelectorAll('.marquee a[data-img]');
		/* warm the cache so the first hover on each title is instant */
		var warm = function () { for (var k = 0; k < links.length; k++) { var pre = new Image(); pre.src = links[k].getAttribute('data-img'); } };
		if ('requestIdleCallback' in window) requestIdleCallback(warm); else setTimeout(warm, 800);
		for (var i = 0; i < links.length; i++) (function (a) {
			a.addEventListener('mouseenter', function () {
				var src = a.getAttribute('data-img');
				cap.innerHTML = '<span>' + a.getAttribute('data-title') + '</span><span>' + a.getAttribute('data-year') + '</span>';
				c.classList.remove('on');
				im.onload = function () { if (im.src.indexOf(src) >= 0 && a.matches(':hover')) c.classList.add('on'); };
				im.src = src;
				if (im.complete && im.naturalWidth) c.classList.add('on');
				setBackdropSpeed(2.2);
				if (!raf) raf = requestAnimationFrame(loop);
			});
			a.addEventListener('mouseleave', function () { c.classList.remove('on'); setBackdropSpeed(1); });
		})(links[i]);
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
		var tiles = [].slice.call(f.children);
		var side = [].slice.call(document.querySelectorAll('.field-side a'));
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
		/* click: the cover grows to fill the window, then the project page loads */
		function go(e, el) {
			if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
			e.preventDefault();
			var img = el.querySelector('img'), r = img.getBoundingClientRect();
			var d = document.createElement('div');
			d.className = 'flip';
			d.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
			d.innerHTML = '<img src="' + img.src + '" alt="">';
			document.body.appendChild(d);
			var href = el.getAttribute('href');
			if (d.animate) {
				d.animate([{}, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' }], { duration: 700, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }).onfinish = function () { location.href = href; };
			} else location.href = href;
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
		addEventListener('hashchange', function () { show(location.hash === '#art' ? 'art' : 'design'); });
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
		if (page === 'home') setupHome();
		if (page === 'project') setupProject();
		if (page === 'field') setupField();
		if (page === 'about') { html.setAttribute('data-glass', 'light'); setupAbout(); }
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
