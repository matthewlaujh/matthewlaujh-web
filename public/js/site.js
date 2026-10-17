/*
 * matthewlaujh.com — site runtime (v2)
 *
 * 1. Base unit: html font-size as a % derived from the viewport (Cargo's
 *    BaseUnit formula, mobile_zoom 25) so every rem keeps its Cargo size.
 * 2. Mobile layout under 770px: nav/footer hide, ☰ toggles the menu.
 * 3. Studio clock + lights-off mode (Mon–Fri 09:00–19:00 Asia/Singapore).
 * 4. Widow/orphan fallback for browsers without text-wrap: pretty.
 * 5. Backdrop boot (MLBackdrops, see backdrops.js).
 */
(function () {
	'use strict';

	var html = document.documentElement;
	var MOBILE_BREAKPOINT = 770;
	var MOBILE_ZOOM = 25;
	var params = new URLSearchParams(location.search);

	/* ---------------- base unit ---------------- */
	var cache = { w: 0, h: 0, size: 0 };

	function measureMaxViewportHeight() {
		var i = 0, o = 100, t;
		for (;;) {
			var n = window.matchMedia('(min-height:' + i + 'px)').matches;
			if (t !== undefined && n !== t) { o /= 2; o *= -1; }
			i += o; t = n;
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
		if (!mobile) closeMenu();
		measureFooter();
		window.dispatchEvent(new CustomEvent('ml:resize', { detail: { w: w, h: h, mobile: mobile } }));
	}

	function measureFooter() {
		var f = document.querySelector('.site-footer:not(.site-footer--inline)');
		if (f) html.style.setProperty('--footer-h', f.offsetHeight + 'px');
	}

	/* ---------------- mobile menu ---------------- */
	var menuBtn, menu, menuOpen = false;
	function openMenu() {
		if (!menu || menuOpen) return;
		menuOpen = true;
		document.body.classList.add('menu-open');
		menuBtn.setAttribute('aria-expanded', 'true');
		menu.scrollTop = 0;
		if (window.MLBackdrops) window.MLBackdrops.init(menu);
	}
	function closeMenu() {
		if (!menu || !menuOpen) return;
		menuOpen = false;
		document.body.classList.remove('menu-open');
		menuBtn.setAttribute('aria-expanded', 'false');
	}
	function setupMenu() {
		menuBtn = document.getElementById('site_menu_button');
		menu = document.getElementById('site_menu');
		if (!menuBtn || !menu) return;
		menuBtn.addEventListener('click', function (e) {
			e.preventDefault();
			menuOpen ? closeMenu() : openMenu();
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') closeMenu();
		});
	}

	/* ---------------- studio clock + lights ---------------- */
	var TZ = 'Asia/Singapore';
	var OPEN = 9, CLOSE = 19; // Mon–Fri 09:00–19:00
	var lightsForced = params.get('lights'); // 'on' | 'off' | null
	var lightsOn = null;

	function sgNow() {
		// parts of "now" in the studio's time zone
		var fmt = new Intl.DateTimeFormat('en-GB', {
			timeZone: TZ, hour12: false, weekday: 'short',
			hour: '2-digit', minute: '2-digit', second: '2-digit'
		});
		var parts = {};
		fmt.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
		var days = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
		return {
			day: days[parts.weekday],
			h: parseInt(parts.hour, 10) % 24,
			m: parseInt(parts.minute, 10),
			s: parseInt(parts.second, 10)
		};
	}

	function studioState() {
		var n = sgNow();
		var weekday = n.day >= 1 && n.day <= 5;
		var mins = n.h * 60 + n.m + n.s / 60;
		var open = weekday && mins >= OPEN * 60 && mins < CLOSE * 60;
		var fill = 0;
		if (open) fill = (mins - OPEN * 60) / ((CLOSE - OPEN) * 60);
		// next opening
		var label;
		if (open) {
			label = 'Studio open · Singapore';
		} else {
			var nextDay;
			if (weekday && mins < OPEN * 60) nextDay = 'today';
			else if (n.day >= 1 && n.day <= 4) nextDay = 'tomorrow';
			else nextDay = 'Monday';
			label = 'Studio closed · opens ' + (nextDay === 'today' ? '09:00' : nextDay + ' 09:00');
		}
		return { open: open, fill: fill, label: label };
	}

	function renderClock() {
		var els = document.querySelectorAll('.studio-clock');
		if (!els.length) return;
		var st = studioState();
		for (var i = 0; i < els.length; i++) {
			var el = els[i];
			var dot = el.querySelector('.dot');
			var txt = el.querySelector('.clock-text');
			if (dot) dot.style.setProperty('--fill', (st.fill * 100).toFixed(2) + '%');
			if (txt && txt.textContent !== st.label) txt.textContent = st.label;
			el.setAttribute('data-open', st.open ? 'true' : 'false');
		}
	}

	function setLights(on) {
		if (lightsOn === on) return;
		lightsOn = on;
		if (on) html.removeAttribute('data-lights'); else html.setAttribute('data-lights', 'off');
		window.dispatchEvent(new CustomEvent('ml:lights', { detail: { on: on } }));
	}

	function setupLights() {
		var st = studioState();
		var on = lightsForced ? lightsForced === 'on' : st.open;
		setLights(on);
		if (on) return;
		// first interaction turns the lights on for this session
		var turnOn = function () {
			setLights(true);
			['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
				window.removeEventListener(ev, turnOn);
			});
		};
		['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
			window.addEventListener(ev, turnOn, { passive: true });
		});
	}

	/* ---------------- widow / orphan fallback ---------------- */
	function fixWidows() {
		if (CSS.supports && CSS.supports('text-wrap', 'pretty')) return;
		var nodes = document.querySelectorAll('.prose p, .prose li');
		for (var i = 0; i < nodes.length; i++) {
			var el = nodes[i];
			var last = el.lastChild;
			while (last && last.nodeType === 1 && last.lastChild) last = last.lastChild;
			if (!last || last.nodeType !== 3) continue;
			var txt = last.nodeValue;
			if (txt.split(' ').length < 4) continue;
			last.nodeValue = txt.replace(/ ([^ ]+)\s*$/, ' $1');
		}
		// glue em dashes to the previous word
		var all = document.querySelectorAll('.prose p');
		for (var j = 0; j < all.length; j++) {
			all[j].innerHTML = all[j].innerHTML.replace(/ — /g, ' — ');
		}
	}

	/* ---------------- init ---------------- */
	function init() {
		setupMenu();
		setBaseUnit();
		window.addEventListener('resize', setBaseUnit, { passive: true });
		setupLights();
		renderClock();
		setInterval(renderClock, 15000);
		fixWidows();
		if (window.MLBackdrops) window.MLBackdrops.init(document.querySelector('.site'));
		document.body.style.visibility = '';
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
