/*
 * matthewlaujh.com — site runtime (ported from Cargo 2)
 *
 * 1. Base unit: html font-size as a percentage derived from the viewport
 *    (Cargo's BaseUnit formula with this site's mobile_zoom = 25).
 * 2. Mobile layout: body.mobile + body.full_width when the viewport is
 *    narrower than 770px (pinned nav/footer hide, grid columns stack).
 * 3. Mobile site menu: the Front Page opens as a full-screen panel.
 * 4. Backdrop init (slitscan / wallpaper) for the current page.
 */
(function () {
	'use strict';

	var html = document.documentElement;
	var MOBILE_BREAKPOINT = 770;
	var MOBILE_ZOOM = 25;

	var cache = { w: 0, h: 0, size: 0 };

	function measureMaxViewportHeight() {
		// Cargo: binary-search (min-height) media queries to get the largest
		// viewport height (100vh including browser chrome on mobile).
		var i = 0, o = 100, t;
		for (;;) {
			var n = window.matchMedia('(min-height:' + i + 'px)').matches;
			if (t !== undefined && n !== t) { o /= 2; o *= -1; }
			i += o;
			t = n;
			if (Math.abs(o) < 0.01) { i = Math.round(i); break; }
		}
		return i;
	}

	function setBaseUnit() {
		var w = html.clientWidth;
		var h = measureMaxViewportHeight();
		cache.w = w; cache.h = h;

		var t = 0;
		if (h > w) t = h / w - 1;
		t /= 0.777777778;
		if (t > 1) t = 1;

		var weight = 9 + (MOBILE_ZOOM - 15) * t;
		var side = w < h ? w : h;
		var size = side / (100 / weight);
		if (size < 20) size = 20;

		if (cache.size !== size) {
			html.style.fontSize = size + '%';
			cache.size = size;
		}

		var mobile = w < MOBILE_BREAKPOINT;
		document.body.classList.toggle('mobile', mobile);
		document.body.classList.toggle('full_width', mobile);
		window.dispatchEvent(new CustomEvent('ml:resize', { detail: { w: w, h: h, mobile: mobile } }));
	}

	/* ---------------- mobile menu ---------------- */
	function setupMenu() {
		var btn = document.getElementById('site_menu_button');
		var panel = document.getElementById('site_menu_panel_container');
		if (!btn || !panel) return;
		var opened = false;
		btn.addEventListener('click', function (e) {
			e.preventDefault();
			if (opened) return;
			opened = true;
			panel.classList.add('open');
			btn.classList.add('active');
			document.body.classList.add('menu-open');
			// init the menu page's backdrop on first open
			if (window.MLBackdrops) window.MLBackdrops.init(panel);
		});
	}

	function init() {
		setBaseUnit();
		window.addEventListener('resize', setBaseUnit, { passive: true });
		setupMenu();
		if (window.MLBackdrops) window.MLBackdrops.init(document.querySelector('.main_container'));
		document.body.style.visibility = '';
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
