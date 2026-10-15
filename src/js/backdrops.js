/*
 * matthewlaujh.com — backdrops (ported from Cargo 2)
 *
 *  - slitscan : dependency-free WebGL re-implementation of Cargo's slit-scan
 *               backdrop (original PIXI filter by Andrew Ohlmann)
 *  - wallpaper: fading image slideshow with "contain" scaling, margin,
 *               overlay colour and hover-to-reveal arrows
 *
 * Each `.backdrop[data-backdrop]` holds a <script type="application/json">
 * with { settings, images }.  window.MLBackdrops.init(root) boots every
 * backdrop inside root.
 */
(function () {
	'use strict';

	/* ======================================================================
	   SLITSCAN
	   ====================================================================== */
var VERT = [
		'attribute vec2 aPos;',
		'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
	].join('\n');

	var FRAG = [
		'precision mediump float;',
		'uniform vec2 dimensions;',
		'uniform vec2 imgDimensions;',
		'uniform float mouseX;',
		'uniform float mouseY;',
		'uniform sampler2D uSampler;',
		'uniform float horizontal;',
		'uniform float scanSize;',
		'uniform float scanCycles;',
		'uniform float scanCyclesLarge;',
		'uniform float wiggle;',
		'uniform float uAlpha;',
		'void main()',
		'{',
		'	vec2 uv = gl_FragCoord.xy / dimensions.xy;',
		'	uv.y = (1.0 - uv.y);',
		'	const int num_samples = 4;',
		'	const float num_samples_f = float(num_samples);',
		'	vec2 dist = vec2(0.0);',
		'	if ( horizontal < 1.0 ) {',
		'		dist = vec2(0.0, 4.0) / dimensions.xy;',
		'	} else {',
		'		dist = vec2(4.0, 0.0) / dimensions.xy;',
		'	}',
		'	vec2 p0 = uv - 0.5*dist;',
		'	vec2 p1 = uv + 0.5*dist;',
		'	vec2 stepvec = (p1-p0)/(num_samples_f-1.0);',
		'	vec2 sumvec = vec2(0.0);',
		'	vec2 waveone = vec2(0.0);',
		'	vec2 wavetwo = vec2(0.0);',
		'	vec2 tempwave = vec2(0.0);',
		'	vec4 sum_bandy = vec4(0.0);',
		'	if ( horizontal < 1.0 ) {',
		'		for(int i=1;i<num_samples;++i)',
		'		{',
		'			p0 += stepvec;',
		'			tempwave.y = (uv.y + p0.y)*2.0*(dimensions.y/imgDimensions.y);',
		'			waveone.y = (uv.y + p0.y)*scanCycles*2.0*(dimensions.y/imgDimensions.y);',
		'			wavetwo.y = (uv.y + p0.y)*scanCyclesLarge*2.0*(dimensions.y/imgDimensions.y);',
		'			waveone.y = (sin((waveone.y*(imgDimensions.x/dimensions.x))+mouseY*3.0)*0.5*scanSize+0.5*scanSize)*0.4;',
		'			wavetwo.y = (cos((wavetwo.y*(imgDimensions.x/dimensions.x)+mouseX)+mouseY*-0.6)*0.5*scanSize+0.5*scanSize)*0.6;',
		'			sumvec.x = uv.x*(1.0-wiggle) + wiggle*0.5 + (sin(tempwave.y*30.0*wiggle+mouseY*1.0)*0.5 + cos(tempwave.y*34.0*wiggle+mouseY*-0.3+2.0)*0.3 + sin(tempwave.y*53.0*wiggle+mouseY*-0.2+30.0)*0.2 + sin(tempwave.y*2.0*wiggle+mouseY*1.0+3.0)*0.5)*wiggle*0.25;',
		'			sumvec.y = waveone.y+wavetwo.y+(1.0-scanSize)*0.5 + (sin(mouseY*-0.1)*0.5)*(1.0-scanSize);',
		'			sum_bandy += texture2D(uSampler, sumvec);',
		'		}',
		'	} else {',
		'		for(int i=1;i<num_samples;++i)',
		'		{',
		'			p0 += stepvec;',
		'			tempwave.x = (uv.x + p0.x)*2.0*(dimensions.x/imgDimensions.x);',
		'			waveone.x = (uv.x + p0.x)*scanCycles*2.0*(dimensions.x/imgDimensions.x);',
		'			wavetwo.x = (uv.x + p0.x)*scanCyclesLarge*2.0*(dimensions.x/imgDimensions.x);',
		'			waveone.x = (sin((waveone.x*(imgDimensions.y/dimensions.y))+mouseX*3.0)*0.5*scanSize+0.5*scanSize)*0.4;',
		'			wavetwo.x = (cos((wavetwo.x*(imgDimensions.y/dimensions.y)+mouseY)+mouseX*-0.6)*0.5*scanSize+0.5*scanSize)*0.6;',
		'			sumvec.y = uv.y*(1.0-wiggle) + wiggle*0.5 + (sin(tempwave.x*30.0*wiggle+mouseX*1.0)*0.5 + cos(tempwave.x*34.0*wiggle+mouseX*-0.3+2.0)*0.3 + sin(tempwave.x*53.0*wiggle+mouseX*-0.2+30.0)*0.2 + sin(tempwave.x*2.0*wiggle+mouseX*1.0+3.0)*0.5)*wiggle*0.25;',
		'			sumvec.x = waveone.x+wavetwo.x+(1.0-scanSize)*0.5 + (sin(mouseX*-0.1)*0.5)*(1.0-scanSize);',
		'			sum_bandy += texture2D(uSampler, sumvec);',
		'		}',
		'	}',
		'	sum_bandy /= (num_samples_f-1.0);',
		'	gl_FragColor = vec4(sum_bandy.rgb, 1.0) * uAlpha;',
		'}'
	].join('\n');

	var DEFAULTS = {
		orientation: 'horizontal',
		scanSize: 90.2,
		scanCycles: 1,
		scanCyclesLarge: 1,
		wiggle: 20,
		targetSpeed: 17,
		mouseInteraction: true,
		scrollInteraction: true,
		hex: '#333333',
		alpha: 0,
		imageWidth: 1024,
		imageHeight: 1024
	};

	function hexToRgb(hex) {
		hex = hex.replace('#', '');
		if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		var n = parseInt(hex, 16);
		return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
	}

	function Slitscan(el, settings) {
		this.el = el;
		this.settings = Object.assign({}, DEFAULTS, settings);
		this.destroyed = false;
		this.paused = true;
		this.inViewport = true;
		this.frame = null;
		this.imageLoaded = false;

		this.data = {
			stage: { w: 800, h: 600, resolution: window.devicePixelRatio || 1 },
			scroll: { x: 0, y: 0 },
			modelSpeed: { x: 0, y: 0 },
			offset: { x: 0, y: 0 },
			mousePrev: { x: -1, y: -1 },
			mouseCur: { x: 0, y: 0 },
			mouseAngle: 0,
			mouseOverride: false,
			mouseCalced: false,
			mouseDelta: { x: 0, y: 0, sx: 0, sy: 0, cx: 0, cy: 0 }
		};

		this.canvas = document.createElement('canvas');
		this.canvas.className = 'slitscan_canvas';
		el.appendChild(this.canvas);

		var gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: false })
			|| this.canvas.getContext('experimental-webgl');
		if (!gl) { el.classList.add('no-webgl'); return; }
		this.gl = gl;

		this.initGL();
		this.makeCallbacks();
		this.loadImage();

		window.addEventListener('pointermove', this.onPointerMove);
		if (this.settings.scrollInteraction) {
			window.addEventListener('scroll', this.onScroll, { passive: true });
		}
		window.addEventListener('resize', this.onResize, { passive: true });
		window.addEventListener('ml:resize', this.onResize);
		document.addEventListener('visibilitychange', this.onVisibility);

		if ('IntersectionObserver' in window) {
			var self = this;
			this.io = new IntersectionObserver(function (entries) {
				self.inViewport = entries[0].isIntersecting;
				if (self.inViewport) self.resume(); else self.pause();
			});
			this.io.observe(el.parentElement || el);
		}

		this.setSize();
	}

	Slitscan.prototype.initGL = function () {
		var gl = this.gl;
		var compile = function (type, src) {
			var s = gl.createShader(type);
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
				throw new Error('slitscan shader: ' + gl.getShaderInfoLog(s));
			}
			return s;
		};
		var prog = gl.createProgram();
		gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			throw new Error('slitscan program: ' + gl.getProgramInfoLog(prog));
		}
		gl.useProgram(prog);
		this.prog = prog;

		var buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		var aPos = gl.getAttribLocation(prog, 'aPos');
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

		this.u = {};
		var names = ['dimensions', 'imgDimensions', 'mouseX', 'mouseY', 'uSampler', 'horizontal', 'scanSize', 'scanCycles', 'scanCyclesLarge', 'wiggle', 'uAlpha'];
		for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(prog, names[i]);

		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.uniform1i(this.u.uSampler, 0);

		// The original filter never updated imgDimensions from the loaded
		// texture, so it stays at the 512x512 default — part of the look.
		gl.uniform2f(this.u.imgDimensions, 512.0, 512.0);

		var rgb = hexToRgb(this.settings.hex);
		gl.clearColor(rgb[0], rgb[1], rgb[2], 1);

		this.setShaderValues();
	};

	Slitscan.prototype.setShaderValues = function () {
		var gl = this.gl, s = this.settings;
		gl.uniform1f(this.u.horizontal, s.orientation === 'horizontal' ? 1.0 : 0.0);
		gl.uniform1f(this.u.scanSize, s.scanSize / 99.99 - 0.01);
		gl.uniform1f(this.u.scanCycles, s.scanCycles);
		gl.uniform1f(this.u.scanCyclesLarge, s.scanCyclesLarge);
		gl.uniform1f(this.u.wiggle, (s.wiggle / 100) * 0.3);
		gl.uniform1f(this.u.uAlpha, 1 - s.alpha);
	};

	Slitscan.prototype.loadImage = function () {
		var self = this;
		var img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = function () {
			if (self.destroyed) return;
			var gl = self.gl;
			gl.bindTexture(gl.TEXTURE_2D, self.texture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
			self.imageLoaded = true;
			var contents = self.el.closest('.backdrop_viewport');
			if (contents) contents.classList.add('loaded');
			if (self.inViewport) self.resume();
		};
		img.src = this.settings.image;
	};

	Slitscan.prototype.setSize = function () {
		var rect = this.el.getBoundingClientRect();
		var width = Math.round(rect.width) || this.el.clientWidth || window.innerWidth;
		var height = Math.round(rect.height) || this.el.clientHeight || window.innerHeight;
		var resolution = window.devicePixelRatio || 1;

		// Cargo caps the pixel budget at 1920x1080
		var pixels = width * resolution * height * resolution;
		var hd = 1920 * 1080;
		if (pixels > hd) {
			var scale = Math.sqrt(hd / pixels);
			width = Math.ceil(width * scale);
			height = Math.ceil(height * scale);
		}

		var st = this.data.stage;
		if (st.w !== width || st.h !== height || st.resolution !== resolution) {
			st.w = width;
			st.h = height;
			st.resolution = resolution;
			this.canvas.width = Math.floor(width * resolution);
			this.canvas.height = Math.floor(height * resolution);
			this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		}
	};

	Slitscan.prototype.updateMotion = function () {
		var s = this.settings, d = this.data;
		var velocity = s.targetSpeed * -0.15;

		if (s.orientation === 'horizontal') {
			if (d.mouseOverride) {
				if (d.mouseAngle > -Math.PI / 2 && d.mouseAngle < Math.PI / 2) {
					if (velocity < 0) velocity = -velocity;
				} else {
					if (velocity > 0) velocity = -velocity;
				}
			}
			d.modelSpeed = { x: velocity, y: 0 };
			d.offset = { x: velocity + d.offset.x, y: 0 };
		} else {
			if (d.mouseOverride) {
				if (d.mouseAngle > 0 && d.mouseAngle < Math.PI) {
					if (velocity < 0) velocity = -velocity;
				} else {
					if (velocity > 0) velocity = -velocity;
				}
			}
			d.modelSpeed = { x: 0, y: velocity };
			d.offset = { x: 0, y: velocity + d.offset.y };
		}
	};

	Slitscan.prototype.setMouseDelta = function () {
		var d = this.data;
		if (Math.abs(d.mouseCur.x - d.mousePrev.x) > 200 || Math.abs(d.mouseCur.y - d.mousePrev.y) > 200) return;

		var dx = d.mouseCur.x - d.mousePrev.x;
		var dy = d.mouseCur.y - d.mousePrev.y;
		var angle = Math.atan2(dy, dx);
		var vel = Math.sqrt(dx * dx + dy * dy);

		if (d.mousePrev.x === -1) {
			d.mouseDelta = { x: 0, y: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
		} else {
			var prevS = { x: d.mouseDelta.sx, y: d.mouseDelta.sy };
			var nx = Math.cos(angle) * vel;
			var ny = Math.sin(angle) * vel;
			var sx = d.mouseDelta.x * 0.1 + prevS.x * 0.9;
			var sy = d.mouseDelta.y * 0.1 + prevS.y * 0.9;
			d.mouseDelta = {
				x: nx,
				y: ny,
				sx: sx,
				sy: sy,
				cx: d.mouseDelta.cx + sx,
				cy: d.mouseDelta.cy + sy
			};
		}

		if (Math.abs(d.mouseDelta.x) > Math.abs(d.modelSpeed.x) && Math.abs(d.mouseDelta.y) > Math.abs(d.modelSpeed.y)) {
			d.mouseAngle = angle;
			d.mouseOverride = true;
		}
	};

	Slitscan.prototype.updateMouseOffset = function (e) {
		if (!this.settings.mouseInteraction) return;
		var d = this.data;
		if (e) {
			d.mouseCur = { x: e.clientX, y: e.clientY };
		} else {
			d.mouseCur = { x: d.mousePrev.x, y: d.mousePrev.y };
		}
		this.setMouseDelta();
		d.mouseCalced = true;
		d.mousePrev = { x: d.mouseCur.x, y: d.mouseCur.y };
	};

	Slitscan.prototype.updateScrollOffset = function () {
		var top = document.documentElement.scrollTop || document.body.scrollTop || 0;
		var left = document.documentElement.scrollLeft || document.body.scrollLeft || 0;
		if (top !== 0) this.data.scroll.y = top;
		if (left !== 0) this.data.scroll.x = left;
	};

	Slitscan.prototype.draw = function () {
		var self = this;
		this.frame = window.requestAnimationFrame(function () { self.draw(); });

		this.updateMotion();
		if (!this.data.mouseCalced) this.setMouseDelta();
		this.data.mouseCalced = false;

		var d = this.data, gl = this.gl;
		var mx = (d.offset.x + d.mouseDelta.cx + d.scroll.x) / 500;
		var my = (d.offset.y + d.mouseDelta.cy + d.scroll.y) / 500;

		gl.uniform1f(this.u.mouseX, mx);
		gl.uniform1f(this.u.mouseY, my);
		gl.uniform2f(this.u.dimensions, d.stage.w * 10, d.stage.h * 10);

		gl.clear(gl.COLOR_BUFFER_BIT);
		if (this.imageLoaded) {
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	};

	Slitscan.prototype.pause = function () {
		window.cancelAnimationFrame(this.frame);
		this.paused = true;
	};

	Slitscan.prototype.resume = function () {
		window.cancelAnimationFrame(this.frame);
		if (this.inViewport && !document.hidden && this.gl) {
			this.paused = false;
			this.draw();
		}
	};

	Slitscan.prototype.makeCallbacks = function () {
		var self = this;
		this.onPointerMove = function (e) { self.updateMouseOffset(e); };
		this.onScroll = function () { self.updateScrollOffset(); };
		this.onResize = function () { self.setSize(); };
		this.onVisibility = function () { if (document.hidden) self.pause(); else self.resume(); };
	};

	Slitscan.prototype.destroy = function () {
		this.destroyed = true;
		this.pause();
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('scroll', this.onScroll);
		window.removeEventListener('resize', this.onResize);
		window.removeEventListener('ml:resize', this.onResize);
		document.removeEventListener('visibilitychange', this.onVisibility);
		if (this.io) this.io.disconnect();
	};

	
	/* ======================================================================
	   WALLPAPER
	   ====================================================================== */
	var WP_DEFAULTS = {
		scale_option: 'cover',
		margin: 0,
		limit_size: false,
		overlay_color: 'rgba(0, 0, 0, 0)',
		bg_color: 'transparent',
		autoplay: true,
		cycle_images: false,
		slideshow_transition: 'slide',
		transition_timeout: 2.5,
		transition_duration: 1,
		randomize: false,
		arrow_navigation: true,
		image_alignment: 'image_center_center'
	};

	var ARROW_SVG = '<svg version="1.1" class="{cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">' +
		'<polyline class="arrow-outline outer-color" points="21,29 10,18 21,7"/>' +
		'<polyline class="arrow-shape inner-color" points="21,29 10,18 21,7"/></svg>';

	function Wallpaper(el, settings, images) {
		this.el = el;
		this.s = Object.assign({}, WP_DEFAULTS, settings);
		this.images = (images || []).filter(function (i) { return !i.exclude_from_backdrop; });
		if (this.s.randomize) this.images.sort(function () { return Math.random() - 0.5; });
		this.current = 0;
		this.timer = null;
		this.w = 0; this.h = 0;

		var viewport = el.querySelector('.backdrop_viewport');
		this.viewport = viewport;
		viewport.innerHTML = '';

		this.bg = document.createElement('div');
		this.bg.className = 'background_background';
		this.bg.style.backgroundColor = this.s.bg_color;
		this.splash = document.createElement('div');
		this.splash.className = 'background_splash';
		this.overlay = document.createElement('div');
		this.overlay.className = 'background_overlay';
		this.overlay.style.backgroundColor = this.s.overlay_color;
		viewport.appendChild(this.bg);
		viewport.appendChild(this.splash);
		viewport.appendChild(this.overlay);

		this.slides = [];
		var self = this;
		var cycling = this.s.cycle_images && this.images.length > 1;
		var list = cycling ? this.images : this.images.slice(0, 1);
		list.forEach(function (img, idx) {
			var outer = document.createElement('div');
			outer.className = 'outer_container' + (cycling ? '' : ' single');
			var slide = document.createElement('div');
			slide.className = 'slide_container';
			var im = document.createElement('img');
			im.setAttribute('width', img.width);
			im.setAttribute('height', img.height);
			im.setAttribute('alt', '');
			im.setAttribute('draggable', 'false');
			im.dataset.src = img.src;
			slide.appendChild(im);
			outer.appendChild(slide);
			self.splash.appendChild(outer);
			self.slides.push({ outer: outer, slide: slide, img: im, data: img, loaded: false });
		});

		this.onResize = function () { self.resize(); };
		window.addEventListener('resize', this.onResize, { passive: true });
		window.addEventListener('ml:resize', this.onResize);

		this.resize();
		this.show(0, true);

		if (cycling) {
			if (this.s.arrow_navigation) this.buildArrows();
			if (this.s.autoplay) this.start();
			document.addEventListener('visibilitychange', function () {
				if (document.hidden) self.stop(); else if (self.s.autoplay) self.start();
			});
		}
	}

	Wallpaper.prototype.load = function (i) {
		var sl = this.slides[i];
		if (!sl || sl.loaded) return;
		sl.loaded = true;
		var self = this;
		sl.img.onload = function () {
			if (i === self.current) self.viewport.classList.add('loaded');
		};
		sl.img.src = sl.img.dataset.src;
	};

	Wallpaper.prototype.resize = function () {
		var w = this.viewport.clientWidth || window.innerWidth;
		var h = this.viewport.clientHeight || window.innerHeight;
		this.w = w; this.h = h;
		var s = this.s;
		var minSide = Math.min(w, h);
		var r = Math.floor(0.005 * s.margin * minSide);
		var l = h - 2 * r;
		var c = w - 2 * r;
		var d = c / l;
		this.splash.style.margin = s.margin == 0 ? '' : r + 'px';

		this.slides.forEach(function (sl) {
			var t = sl.data.width, i = sl.data.height, n = t / i;
			var sw = s.limit_size && s.scale_option !== 'cover' ? Math.min(t, c) : c;
			var sh = s.limit_size && s.scale_option !== 'cover' ? Math.min(i, l) : l;
			var hh, g, u, p, m;
			if (s.scale_option === 'cover') {
				if (n <= d) { m = sw / t; hh = sw; g = i * m; }
				else { m = sh / i; g = sh; hh = t * m; }
				u = (c - hh) * 0.5; p = (l - g) * 0.5;
			} else {
				if (n >= d) { m = sw / t; hh = sw; g = i * m; }
				else { m = sh / i; g = sh; hh = t * m; }
				u = 0.5 * (c - hh); p = 0.5 * (l - g);
			}
			sl.slide.style.width = hh + 'px';
			sl.slide.style.height = g + 'px';
			sl.slide.style.marginLeft = u + 'px';
			sl.slide.style.marginTop = p + 'px';
		});
	};

	Wallpaper.prototype.show = function (i, immediate) {
		var n = this.slides.length;
		if (!n) return;
		i = ((i % n) + n) % n;
		this.current = i;
		this.load(i);
		this.load((i + 1) % n);
		var self = this;
		this.slides.forEach(function (sl, k) {
			sl.outer.classList.toggle('current', k === i);
			sl.outer.style.transitionDuration = immediate ? '0s' : (Math.max(self.s.transition_duration, 0)) + 's';
		});
		if (this.slides[i].img.complete && this.slides[i].img.naturalWidth) this.viewport.classList.add('loaded');
	};

	Wallpaper.prototype.next = function () { this.show(this.current + 1); this.restart(); };
	Wallpaper.prototype.prev = function () { this.show(this.current - 1); this.restart(); };

	Wallpaper.prototype.start = function () {
		var self = this;
		this.stop();
		var ms = Math.max(this.s.transition_timeout, 0.1) * 1000;
		this.timer = setInterval(function () { self.show(self.current + 1); }, ms);
	};
	Wallpaper.prototype.stop = function () { clearInterval(this.timer); this.timer = null; };
	Wallpaper.prototype.restart = function () { if (this.s.autoplay) this.start(); };

	Wallpaper.prototype.buildArrows = function () {
		var self = this;
		var nav = document.createElement('div');
		nav.className = 'backdrop wallpaper_navigation wallpaper-navigation';
		nav.setAttribute('data-auxiliary', '');
		var inner = document.createElement('div');
		var prev = document.createElement('div');
		prev.className = 'slick-prev slick-arrow previous hidden';
		prev.innerHTML = ARROW_SVG.replace('{cls}', 'left-arrow');
		var next = document.createElement('div');
		next.className = 'slick-next slick-arrow next hidden';
		next.innerHTML = ARROW_SVG.replace('{cls}', 'right-arrow');
		inner.appendChild(prev);
		inner.appendChild(next);
		nav.appendChild(inner);
		this.el.parentElement.appendChild(nav);
		this.nav = nav;

		prev.addEventListener('click', function (e) { e.preventDefault(); self.prev(); });
		next.addEventListener('click', function (e) { e.preventDefault(); self.next(); });

		var hideTimer = null, overArrow = false;
		function showUI() {
			clearTimeout(hideTimer);
			prev.classList.remove('hidden');
			next.classList.remove('hidden');
			if (!overArrow) hideTimer = setTimeout(hideUI, 1500);
		}
		function hideUI() {
			prev.classList.add('hidden');
			next.classList.add('hidden');
		}
		var pageContainer = this.el.closest('.page_container') || document.body;
		pageContainer.addEventListener('mousemove', showUI);
		pageContainer.addEventListener('mouseleave', function () {
			if (!overArrow) hideTimer = setTimeout(hideUI, 250);
		});
		[prev, next].forEach(function (a) {
			a.addEventListener('mouseenter', function () { overArrow = true; clearTimeout(hideTimer); showUI(); });
			a.addEventListener('mouseleave', function () { overArrow = false; });
		});
		// Cargo shows the arrows for 1.5s on load, then hides them
		showUI();
	};

	/* ======================================================================
	   INIT
	   ====================================================================== */
	function initBackdrop(el) {
		if (el.__ml_inited) return;
		el.__ml_inited = true;
		var cfgEl = el.querySelector('script[type="application/json"]');
		var cfg = {};
		try { cfg = JSON.parse(cfgEl ? cfgEl.textContent : '{}'); } catch (e) { cfg = {}; }
		var type = el.getAttribute('data-backdrop');
		var viewport = el.querySelector('.backdrop_viewport');
		if (!viewport) return;
		try {
			if (type === 'slitscan') {
				var canvasHost = document.createElement('div');
				canvasHost.setAttribute('data-backdrop', 'slitscan');
				canvasHost.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
				viewport.appendChild(canvasHost);
				var s = cfg.settings || {};
				el.__instance = new Slitscan(canvasHost, {
					orientation: s.orientation,
					scanSize: parseFloat(s.scan_size),
					scanCycles: parseFloat(s.scan_cycles),
					scanCyclesLarge: parseFloat(s.scan_cycles_large),
					wiggle: parseFloat(s.wiggle),
					targetSpeed: parseFloat(s.target_speed),
					mouseInteraction: s.mouse_interaction !== false,
					scrollInteraction: s.scroll_interaction !== false,
					hex: s.hex || '#333',
					alpha: parseFloat(s.alpha) || 0,
					image: cfg.image && cfg.image.src,
					imageWidth: cfg.image && cfg.image.width,
					imageHeight: cfg.image && cfg.image.height
				});
			} else if (type === 'wallpaper') {
				el.__instance = new Wallpaper(el, cfg.settings || {}, cfg.images || []);
			}
		} catch (e) {
			if (window.console) console.warn('backdrop failed', e);
		}
	}

	window.MLBackdrops = {
		init: function (root) {
			root = root || document;
			var els = root.querySelectorAll('.backdrop[data-backdrop]');
			for (var i = 0; i < els.length; i++) initBackdrop(els[i]);
		}
	};
})();
