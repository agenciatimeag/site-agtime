/* Agência Time — runtime do site (substitui o JavaScript do Framer).
   Lê as configurações de animação extraídas do site original (#fx-data) e as reproduz
   com Web Animations API + CSS. Sem dependências. */
;(function () {
	"use strict"
	var doc = document
	var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches
	var $$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)) }
	var readJSON = function (id) { var el = doc.getElementById(id); if (!el) return null; try { return JSON.parse(el.textContent) } catch (e) { return null } }
	var FX = readJSON("fx-data") || { el: {}, comps: [] }

	/* ---------- motion helpers ---------- */
	var springCache = {}
	function springEasing(t) {
		var stiffness = t.stiffness, damping = t.damping, mass = t.mass || 1
		if (stiffness == null) {
			var d = Math.max(0.05, t.duration == null ? 0.4 : t.duration)
			var z0 = Math.min(1, Math.max(0.05, 1 - (t.bounce == null ? 0.25 : t.bounce)))
			var w = (z0 >= 1 ? 6.6 : 5.2 / z0) / d
			stiffness = w * w * mass
			damping = 2 * z0 * Math.sqrt(stiffness * mass)
		}
		var key = stiffness + "|" + damping + "|" + mass
		if (springCache[key]) return springCache[key]
		var w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass))
		var x = function (s) {
			if (z < 1) { var wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + (z * w0 / wd) * Math.sin(wd * s)) }
			if (z === 1) return 1 - Math.exp(-w0 * s) * (1 + w0 * s)
			var r1 = -w0 * (z - Math.sqrt(z * z - 1)), r2 = -w0 * (z + Math.sqrt(z * z - 1))
			return 1 - (r2 * Math.exp(r1 * s) - r1 * Math.exp(r2 * s)) / (r2 - r1)
		}
		var end = 0.1
		for (var s = 0; s < 10; s += 0.01) {
			var ok = true
			for (var k = s; k < s + 0.3; k += 0.02) if (Math.abs(1 - x(k)) > 0.0015) { ok = false; break }
			end = s
			if (ok) { end = Math.max(s, 0.1); break }
		}
		var pts = []
		for (var i = 0; i <= 40; i++) pts.push(i === 40 ? 1 : +x((end * i) / 40).toFixed(4))
		var supportsLinear = window.CSS && CSS.supports && CSS.supports("transition-timing-function", "linear(0, 1)")
		return (springCache[key] = { duration: Math.round(end * 1000), easing: supportsLinear ? "linear(" + pts.join(",") + ")" : "cubic-bezier(0.22, 1, 0.36, 1)" })
	}
	function timing(tr) {
		tr = tr || {}
		var delay = Math.round((tr.delay || 0) * 1000)
		if (tr.type === "tween" || (tr.type !== "spring" && tr.ease)) {
			var e = Array.isArray(tr.ease) ? "cubic-bezier(" + tr.ease.join(",") + ")" : tr.ease === "linear" ? "linear" : "cubic-bezier(0.44,0,0.56,1)"
			return { duration: Math.round((tr.duration == null ? 0.3 : tr.duration) * 1000), easing: e, delay: delay }
		}
		var sp = springEasing(tr)
		return { duration: sp.duration, easing: sp.easing, delay: delay }
	}
	var num = function (v, d) { return v == null || v === "" ? (d || 0) : parseFloat(v) }
	function transformOf(s) {
		s = s || {}
		var p = [], x = num(s.x), y = num(s.y)
		var unit = function (v) { return typeof v === "string" && /%$/.test(v) ? v : num(v) + "px" }
		if (x || y) p.push("translate(" + unit(s.x || 0) + ", " + unit(s.y || 0) + ")")
		var sc = s.scale == null ? 1 : num(s.scale, 1)
		if (sc !== 1) p.push("scale(" + sc + ")")
		if (num(s.rotate)) p.push("rotate(" + num(s.rotate) + "deg)")
		if (num(s.rotateX)) p.push("rotateX(" + num(s.rotateX) + "deg)")
		if (num(s.rotateY)) p.push("rotateY(" + num(s.rotateY) + "deg)")
		if (num(s.skewX)) p.push("skewX(" + num(s.skewX) + "deg)")
		if (num(s.skewY)) p.push("skewY(" + num(s.skewY) + "deg)")
		return p.length ? p.join(" ") : "none"
	}
	function frame(s) {
		var f = { transform: transformOf(s) }
		if (s && s.opacity != null) f.opacity = s.opacity
		if (s && s.filter) f.filter = s.filter
		return f
	}
	function play(el, from, to, tr, done) {
		var t = timing(tr)
		if (reduce) t.duration = 1
		var a = el.animate([from, to], { duration: t.duration, delay: t.delay, easing: t.easing, fill: "both" })
		a.onfinish = function () {
			for (var k in to) el.style[k] = to[k]
			a.cancel()
			done && done()
		}
		return a
	}
	var shown = function (el) { return el.getClientRects().length > 0 }
	function inView(el, threshold, cb) {
		if (!("IntersectionObserver" in window)) return cb()
		var io = new IntersectionObserver(function (es) {
			es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); cb() } })
		}, { threshold: Math.min(threshold || 0, 0.99) })
		io.observe(el)
	}
	var below = function (el) { var r = el.getBoundingClientRect(); return r.top > innerHeight * 0.95 }
	var byClass = function (cls) { return $$("." + cls.replace(/([^\w-])/g, "\\$1")) }

	/* ---------- 1. entrada ao carregar (appear) ---------- */
	function appearOnLoad() {
		var cfg = readJSON("__framer__appearAnimationsContent"), bps = readJSON("__framer__breakpoints") || []
		if (!cfg) return
		var active = bps.filter(function (b) { return matchMedia(b.mediaQuery).matches }).map(function (b) { return b.hash })
		$$("[data-framer-appear-id]").forEach(function (el) {
			var c = cfg[el.getAttribute("data-framer-appear-id")]
			if (!c) { el.style.opacity = ""; return }
			var v = null
			for (var i = 0; i < active.length; i++) if (c[active[i]]) { v = c[active[i]]; break }
			v = v || c.default
			if (!v) return
			play(el, frame(v.initial), frame(v.animate), v.animate && v.animate.transition)
		})
	}

	/* ---------- 2. texto palavra a palavra ---------- */
	function textEffects() {
		Object.keys(FX.el).forEach(function (cls) {
			var conf = null
			FX.el[cls].forEach(function (e) { if (e.effect && e.effect.type === "appear") conf = e.effect })
			if (!conf) return
			byClass(cls).forEach(function (el) {
				var tokens = $$("span[style*='opacity']", el).filter(function (s) { return /opacity:\s*0\.001/.test(s.getAttribute("style")) })
				if (!tokens.length) return
				var run = function () {
					var tr = conf.transition || {}, stagger = (tr.delay || 0.03) * 1000, base = (conf.startDelay || 0) * 1000
					tokens.forEach(function (t, i) {
						var trI = Object.assign({}, tr, { delay: (base + i * stagger) / 1000 })
						play(t, { opacity: 0.001, filter: (conf.effect && conf.effect.filter) || "none", transform: transformOf(conf.effect) }, { opacity: 1, filter: "blur(0px)", transform: "none" }, trI)
					})
				}
				if (conf.trigger === "onMount" || !below(el)) setTimeout(run, 60)
				else inView(el, conf.threshold || 0.5, run)
			})
		})
	}

	/* ---------- 3. transformação ao entrar na tela (repete ao sair e voltar, como no Framer) ---------- */
	function animateTo(el, to, tr) {
		var cs = getComputedStyle(el), from = { transform: cs.transform === "none" ? "none" : cs.transform, opacity: cs.opacity }
		if (el._fx) el._fx.cancel()
		var t = timing(tr)
		if (reduce) t.duration = 1
		var a = (el._fx = el.animate([from, to], { duration: t.duration, delay: t.delay, easing: t.easing, fill: "both" }))
		a.onfinish = function () { for (var k in to) el.style[k] = to[k]; if (el._fx === a) { el._fx = null; a.cancel() } }
	}
	function transformOnView() {
		Object.keys(FX.el).forEach(function (cls) {
			FX.el[cls].forEach(function (e) {
				if (!e.__framer__transformTargets || e.__framer__transformTrigger !== "onInView") return
				var t = e.__framer__transformTargets, from = t[0] && t[0].target, to = t[t.length - 1] && t[t.length - 1].target
				if (!from || !to) return
				var tr = e.__framer__spring || { type: "spring", stiffness: 200, damping: 60, mass: 1 }
				var f = frame(from), g = frame(to)
				if (f.opacity == null) f.opacity = 1
				if (g.opacity == null) g.opacity = e.__targetOpacity == null ? 1 : e.__targetOpacity
				byClass(cls).forEach(function (el) {
					el.style.transform = f.transform; el.style.opacity = f.opacity
					if (!("IntersectionObserver" in window)) { el.style.transform = g.transform; el.style.opacity = g.opacity; return }
					var inside = null
					new IntersectionObserver(function (es) {
						es.forEach(function (x) {
							if (x.isIntersecting === inside) return
							inside = x.isIntersecting
							animateTo(el, inside ? g : f, tr)
						})
					}, { threshold: 0 }).observe(el)
				})
			})
		})
	}

	/* ---------- 4. loops ---------- */
	function loops() {
		Object.keys(FX.el).forEach(function (cls) {
			FX.el[cls].forEach(function (e) {
				if (!e.__framer__loopEffectEnabled || !e.__framer__loop || reduce) return
				var tr = e.__framer__loopTransition || {}, t = timing(tr)
				var hold = (e.__framer__loopRepeatDelay || 0) * 1000, total = t.duration + hold
				var mirror = e.__framer__loopRepeatType === "mirror"
				var base = { transform: "none", opacity: e.__targetOpacity == null ? 1 : e.__targetOpacity }
				var target = frame(e.__framer__loop)
				if (target.opacity == null) target.opacity = base.opacity
				byClass(cls).forEach(function (el) {
					var kf = [Object.assign({ offset: 0, easing: t.easing }, base), Object.assign({ offset: t.duration / total }, target)]
					if (hold) kf.push(Object.assign({ offset: 1 }, target))
					el.animate(kf, { duration: total, delay: t.delay, iterations: Infinity, direction: mirror ? "alternate" : "normal" })
				})
			})
		})
	}

	/* ---------- 5. menu que esconde ao rolar para baixo ---------- */
	function scrollDirection() {
		Object.keys(FX.el).forEach(function (cls) {
			FX.el[cls].forEach(function (e) {
				var sd = e.__framer__scrollDirection
				if (!sd || !sd.target) return
				var tr = (e.__framer__animate && e.__framer__animate.transition) || { type: "spring", stiffness: 300, damping: 60 }
				var t = timing(tr)
				byClass(cls).forEach(function (el) {
					var last = scrollY, hidden = false
					el.style.transition = "transform " + t.duration + "ms " + t.easing
					addEventListener("scroll", function () {
						var y = scrollY, d = y - last
						if (Math.abs(d) < 4) return
						var hide = sd.direction === "down" ? d > 0 && y > 120 : d < 0
						if (hide !== hidden) { hidden = hide; el.style.transform = hide ? transformOf(sd.target) : "none" }
						last = y
					}, { passive: true })
				})
			})
		})
	}

	/* ---------- 6. hover (variantes de componentes) ---------- */
	var TRANSFORM_KEYS = { x: 1, y: 1, scale: 1, rotate: 1, rotateX: 1, rotateY: 1, skewX: 1, skewY: 1 }
	function hoverVariants() {
		(FX.comps || []).forEach(function (c) {
			if (!c.enabledGestures || !c.scopes || !c.scopes.length) return
			var vClass = c.variantClassNames || {}
			c.scopes.forEach(function (scope) {
				byClass(scope).forEach(function (root) {
					var base = null
					for (var id in vClass) if (root.classList.contains(vClass[id])) { base = id; break }
					base = base || c.defaultVariant
					var g = c.enabledGestures[base]
					if (!g || !g.hover) return
					var key = base + "-hover", targets = []
					var cand = [root].concat($$("*", root))
					cand.forEach(function (el) {
						for (var i = 0; i < el.classList.length; i++) {
							var list = FX.el[el.classList[i]]
							if (!list) continue
							for (var j = 0; j < list.length; j++) {
								var v = list[j].variants
								if (v && v[key] && (!list[j].comp || list[j].comp === scope)) { targets.push({ el: el, style: v[key], tr: list[j].transition }); i = el.classList.length; break }
							}
						}
					})
					if (!targets.length && !doc.querySelector(".hover")) return
					var saved = null
					var apply = function (on) {
						root.classList.toggle("hover", on)
						if (!saved) saved = targets.map(function (t) { var o = {}; for (var k in t.style) o[k] = k.indexOf("--") === 0 ? t.el.style.getPropertyValue(k) : TRANSFORM_KEYS[k] ? t.el.style.transform : t.el.style[k]; return o })
						targets.forEach(function (t, i) {
							var tm = timing(t.tr && !t.tr.$ref ? t.tr : { type: "spring", duration: 0.3, bounce: 0.2 })
							t.el.style.transition = "all " + tm.duration + "ms " + tm.easing
							var tf = {}
							for (var k in t.style) {
								var val = on ? t.style[k] : saved[i][k]
								if (k.indexOf("--") === 0) t.el.style.setProperty(k, val || "")
								else if (TRANSFORM_KEYS[k]) tf[k] = t.style[k]
								else t.el.style[k] = val == null ? "" : val
							}
							if (Object.keys(tf).length) t.el.style.transform = on ? transformOf(tf) : (saved[i].x || "")
						})
					}
					root.addEventListener("pointerenter", function (ev) { if (ev.pointerType !== "touch") apply(true) })
					root.addEventListener("pointerleave", function () { apply(false) })
				})
			})
		})
	}

	/* ---------- 7. texto que acende com a rolagem (Reveal Text) ---------- */
	function revealText() {
		$$("[data-reveal-text]").forEach(function (p) {
			var start = +p.getAttribute("data-reveal-text") || 0
			var words = $$(":scope > span", p), m = words.length, chars = [], idx = 0
			words.forEach(function (w, wi) {
				var cs = $$(":scope > span", w), n = cs.length
				cs.forEach(function (c, ci) { chars.push({ el: c, a: wi / m + (ci / n) / m, b: wi / m + ((ci + 1) / n) / m, i: idx++ }) })
				idx++
			})
			var mix = function (t) { var v = Math.round(102 + (255 - 102) * t); return "rgb(" + v + "," + v + "," + v + ")" }
			var tick = function () {
				var r = p.getBoundingClientRect(), vh = innerHeight
				var prog = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (vh * 0.6)))
				chars.forEach(function (c) {
					var t = c.i < start ? 1 : Math.min(1, Math.max(0, (prog - c.a) / (c.b - c.a)))
					c.el.style.color = mix(t)
				})
			}
			addEventListener("scroll", function () { requestAnimationFrame(tick) }, { passive: true })
			tick()
		})
	}

	/* ---------- 8. componentes com estado (FAQ, menu do celular) ---------- */
	function variantStyles(root, scope, variantId) {
		var out = []
		;[root].concat($$("*", root)).forEach(function (el) {
			for (var i = 0; i < el.classList.length; i++) {
				var list = FX.el[el.classList[i]]
				if (!list) continue
				for (var j = 0; j < list.length; j++) {
					var v = list[j].variants
					if (v && v[variantId] && (!list[j].comp || list[j].comp === scope)) { out.push({ el: el, style: v[variantId] }); return }
				}
			}
		})
		return out
	}
	function variantToggles() {
		$$("[data-vt]").forEach(function (root) {
			var c
			try { c = JSON.parse(root.getAttribute("data-vt")) } catch (e) { return }
			var targets = variantStyles(root, c.scope, c.id)
			var saved = targets.map(function (t) { var o = {}; for (var k in t.style) o[k] = k.indexOf("--") === 0 ? t.el.style.getPropertyValue(k) : TRANSFORM_KEYS[k] ? t.el.style.transform : t.el.style[k]; return o })
			var tm = timing(c.transition || { type: "spring", duration: 0.4, bounce: 0.2 })
			var open = false
			var trig = c.trigger ? root.querySelector(c.trigger) : root
			if (!trig) return
			trig.setAttribute("role", "button"); trig.setAttribute("tabindex", "0"); trig.setAttribute("aria-expanded", "false")
			var toggle = function () {
				var h0 = root.getBoundingClientRect().height
				open = !open
				root.classList.toggle(c.from, !open); root.classList.toggle(c.to, open); root.classList.toggle("is-open", open)
				trig.setAttribute("aria-expanded", String(open))
				targets.forEach(function (t, i) {
					t.el.style.transition = reduce ? "none" : "transform " + tm.duration + "ms " + tm.easing + ", background " + tm.duration + "ms ease, border-color " + tm.duration + "ms ease"
					var tf = {}
					for (var k in t.style) {
						if (k.indexOf("--") === 0) t.el.style.setProperty(k, open ? t.style[k] : saved[i][k] || "")
						else if (TRANSFORM_KEYS[k]) tf[k] = t.style[k]
						else t.el.style[k] = open ? t.style[k] : saved[i][k] || ""
					}
					if (Object.keys(tf).length) t.el.style.transform = open ? transformOf(tf) : saved[i][Object.keys(tf)[0]] || "none"
				})
				var h1 = root.getBoundingClientRect().height
				if (!reduce && Math.abs(h0 - h1) > 1) {
					var ov = root.style.overflow
					root.style.overflow = "hidden"
					var a = root.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: tm.duration, easing: tm.easing })
					a.onfinish = a.oncancel = function () { root.style.overflow = ov }
				}
			}
			trig.addEventListener("click", function (ev) {
				if (!c.trigger && ev.target.closest("a[href]") && ev.target.closest("[data-when-open]")) return
				ev.preventDefault()
				toggle()
			})
			trig.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle() } })
			if (c.closeOnLink) $$("a[href]", root).forEach(function (a) { a.addEventListener("click", function () { if (open) toggle() }) })
		})
	}

	/* ---------- 9. carrossel infinito (Ticker do Framer) ---------- */
	function tickers() {
		$$("[data-ticker]").forEach(function (list) {
			var section = list.parentElement
			var speed = +list.getAttribute("data-ticker") || 100, dir = list.getAttribute("data-ticker-dir") || "left"
			var hoverFactor = +(list.getAttribute("data-ticker-hover") || 1)
			var horiz = dir === "left" || dir === "right"
			var items = Array.prototype.slice.call(list.children)
			section.style.opacity = 1
			if (!items.length) return
			var anim = null, clones = []
			var setup = function () {
				clones.forEach(function (c) { c.remove() }); clones = []
				if (anim) { anim.cancel(); anim = null }
				var first = items[0], last = items[items.length - 1]
				var gap = parseFloat(getComputedStyle(list).gap) || 0
				var parent = horiz ? section.offsetWidth : section.offsetHeight
				var children = (horiz ? last.offsetLeft + last.offsetWidth - first.offsetLeft : last.offsetTop + last.offsetHeight - first.offsetTop) + gap
				if (!parent || children <= gap) return
				var reps = Math.min(Math.round((parent / children) * 2) + 1, 100)
				for (var r = 0; r < reps; r++) items.forEach(function (it) { var c = it.cloneNode(true); c.setAttribute("aria-hidden", "true"); list.appendChild(c); clones.push(c) })
				var W = children + children * Math.round(parent / children)
				var tf = { left: function (v) { return "translateX(-" + v + "px)" }, right: function (v) { return "translateX(" + v + "px)" }, top: function (v) { return "translateY(-" + v + "px)" }, bottom: function (v) { return "translateY(" + v + "px)" } }[dir]
				if (dir === "right") list.style.left = -W + "px"
				if (dir === "bottom") list.style.top = -W + "px"
				list.style.willChange = "transform"
				if (reduce || !speed) return
				anim = list.animate({ transform: [tf(0), tf(W)] }, { duration: (Math.abs(W) / speed) * 1000, iterations: Infinity, easing: "linear" })
			}
			setup()
			var lastW = innerWidth
			addEventListener("resize", function () { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; setup() } })
			list.addEventListener("mouseenter", function () { if (anim) anim.playbackRate = hoverFactor })
			list.addEventListener("mouseleave", function () { if (anim) anim.playbackRate = 1 })
			doc.addEventListener("visibilitychange", function () { if (anim) doc.hidden ? anim.pause() : anim.play() })
		})
	}

	/* ---------- 9b. raios de luz (shader WebGL do componente "Light Rays") ---------- */
	var RAYS_FRAG = "\n// Uniforms\n\nuniform vec2 u_resolution;\nuniform vec2 u_mouse;\nuniform float u_time;\nuniform vec4 u_colors[2];\nuniform float u_intensity;\nuniform float u_rays;\nuniform float u_reach;\nuniform vec2 u_rayPos1;\nuniform vec2 u_rayPos2;\n\n#ifndef FNC_MOD289\n#define FNC_MOD289\n\nfloat mod289(const in float x) { return x - floor(x * (1. / 289.)) * 289.; }\nvec2 mod289(const in vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }\nvec3 mod289(const in vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }\nvec4 mod289(const in vec4 x) { return x - floor(x * (1. / 289.)) * 289.; }\n\n#endif\n\n#ifndef FNC_PERMUTE\n#define FNC_PERMUTE\n\nfloat permute(const in float x) { return mod289(((x * 34.0) + 1.0) * x); }\nvec2 permute(const in vec2 x) { return mod289(((x * 34.0) + 1.0) * x); }\nvec3 permute(const in vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }\nvec4 permute(const in vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }\n\n#endif\n\n#ifndef FNC_TAYLORINVSQRT\n#define FNC_TAYLORINVSQRT\nfloat taylorInvSqrt(in float r) { return 1.79284291400159 - 0.85373472095314 * r; }\nvec2 taylorInvSqrt(in vec2 r) { return 1.79284291400159 - 0.85373472095314 * r; }\nvec3 taylorInvSqrt(in vec3 r) { return 1.79284291400159 - 0.85373472095314 * r; }\nvec4 taylorInvSqrt(in vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }\n#endif\n\n#ifndef FNC_QUINTIC\n#define FNC_QUINTIC \n\nfloat quintic(const in float v) { return v*v*v*(v*(v*6.0-15.0)+10.0); }\nvec2  quintic(const in vec2 v)  { return v*v*v*(v*(v*6.0-15.0)+10.0); }\nvec3  quintic(const in vec3 v)  { return v*v*v*(v*(v*6.0-15.0)+10.0); }\nvec4  quintic(const in vec4 v)  { return v*v*v*(v*(v*6.0-15.0)+10.0); }\n\n#endif\n\n#ifndef FNC_PNOISE\n#define FNC_PNOISE\n\nfloat pnoise(in vec2 P, in vec2 rep) {\n    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);\n    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);\n    Pi = mod(Pi, rep.xyxy); \n    Pi = mod289(Pi);        \n    vec4 ix = Pi.xzxz;\n    vec4 iy = Pi.yyww;\n    vec4 fx = Pf.xzxz;\n    vec4 fy = Pf.yyww;\n\n    vec4 i = permute(permute(ix) + iy);\n\n    vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;\n    vec4 gy = abs(gx) - 0.5 ;\n    vec4 tx = floor(gx + 0.5);\n    gx = gx - tx;\n\n    vec2 g00 = vec2(gx.x,gy.x);\n    vec2 g10 = vec2(gx.y,gy.y);\n    vec2 g01 = vec2(gx.z,gy.z);\n    vec2 g11 = vec2(gx.w,gy.w);\n\n    vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));\n    g00 *= norm.x;\n    g01 *= norm.y;\n    g10 *= norm.z;\n    g11 *= norm.w;\n\n    float n00 = dot(g00, vec2(fx.x, fy.x));\n    float n10 = dot(g10, vec2(fx.y, fy.y));\n    float n01 = dot(g01, vec2(fx.z, fy.z));\n    float n11 = dot(g11, vec2(fx.w, fy.w));\n\n    vec2 fade_xy = quintic(Pf.xy);\n    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);\n    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);\n    return 2.3 * n_xy;\n}\n\nfloat pnoise(in vec3 P, in vec3 rep) {\n    vec3 Pi0 = mod(floor(P), rep); \n    vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); \n    Pi0 = mod289(Pi0);\n    Pi1 = mod289(Pi1);\n    vec3 Pf0 = fract(P); \n    vec3 Pf1 = Pf0 - vec3(1.0); \n    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n    vec4 iy = vec4(Pi0.yy, Pi1.yy);\n    vec4 iz0 = Pi0.zzzz;\n    vec4 iz1 = Pi1.zzzz;\n\n    vec4 ixy = permute(permute(ix) + iy);\n    vec4 ixy0 = permute(ixy + iz0);\n    vec4 ixy1 = permute(ixy + iz1);\n\n    vec4 gx0 = ixy0 * (1.0 / 7.0);\n    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\n    gx0 = fract(gx0);\n    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n    vec4 sz0 = step(gz0, vec4(0.0));\n    gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n    gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n\n    vec4 gx1 = ixy1 * (1.0 / 7.0);\n    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\n    gx1 = fract(gx1);\n    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n    vec4 sz1 = step(gz1, vec4(0.0));\n    gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n    gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n\n    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n\n    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\n    g000 *= norm0.x;\n    g010 *= norm0.y;\n    g100 *= norm0.z;\n    g110 *= norm0.w;\n    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\n    g001 *= norm1.x;\n    g011 *= norm1.y;\n    g101 *= norm1.z;\n    g111 *= norm1.w;\n\n    float n000 = dot(g000, Pf0);\n    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n    float n111 = dot(g111, Pf1);\n\n    vec3 fade_xyz = quintic(Pf0);\n    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n    return 2.2 * n_xyz;\n}\n\nfloat pnoise(in vec4 P, in vec4 rep) {\n    vec4 Pi0 = mod(floor(P), rep); \n    vec4 Pi1 = mod(Pi0 + 1.0, rep); \n    Pi0 = mod289(Pi0);\n    Pi1 = mod289(Pi1);\n    vec4 Pf0 = fract(P); \n    vec4 Pf1 = Pf0 - 1.0; \n    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n    vec4 iy = vec4(Pi0.yy, Pi1.yy);\n    vec4 iz0 = vec4(Pi0.zzzz);\n    vec4 iz1 = vec4(Pi1.zzzz);\n    vec4 iw0 = vec4(Pi0.wwww);\n    vec4 iw1 = vec4(Pi1.wwww);\n\n    vec4 ixy = permute(permute(ix) + iy);\n    vec4 ixy0 = permute(ixy + iz0);\n    vec4 ixy1 = permute(ixy + iz1);\n    vec4 ixy00 = permute(ixy0 + iw0);\n    vec4 ixy01 = permute(ixy0 + iw1);\n    vec4 ixy10 = permute(ixy1 + iw0);\n    vec4 ixy11 = permute(ixy1 + iw1);\n\n    vec4 gx00 = ixy00 * (1.0 / 7.0);\n    vec4 gy00 = floor(gx00) * (1.0 / 7.0);\n    vec4 gz00 = floor(gy00) * (1.0 / 6.0);\n    gx00 = fract(gx00) - 0.5;\n    gy00 = fract(gy00) - 0.5;\n    gz00 = fract(gz00) - 0.5;\n    vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);\n    vec4 sw00 = step(gw00, vec4(0.0));\n    gx00 -= sw00 * (step(0.0, gx00) - 0.5);\n    gy00 -= sw00 * (step(0.0, gy00) - 0.5);\n\n    vec4 gx01 = ixy01 * (1.0 / 7.0);\n    vec4 gy01 = floor(gx01) * (1.0 / 7.0);\n    vec4 gz01 = floor(gy01) * (1.0 / 6.0);\n    gx01 = fract(gx01) - 0.5;\n    gy01 = fract(gy01) - 0.5;\n    gz01 = fract(gz01) - 0.5;\n    vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);\n    vec4 sw01 = step(gw01, vec4(0.0));\n    gx01 -= sw01 * (step(0.0, gx01) - 0.5);\n    gy01 -= sw01 * (step(0.0, gy01) - 0.5);\n\n    vec4 gx10 = ixy10 * (1.0 / 7.0);\n    vec4 gy10 = floor(gx10) * (1.0 / 7.0);\n    vec4 gz10 = floor(gy10) * (1.0 / 6.0);\n    gx10 = fract(gx10) - 0.5;\n    gy10 = fract(gy10) - 0.5;\n    gz10 = fract(gz10) - 0.5;\n    vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);\n    vec4 sw10 = step(gw10, vec4(0.0));\n    gx10 -= sw10 * (step(0.0, gx10) - 0.5);\n    gy10 -= sw10 * (step(0.0, gy10) - 0.5);\n\n    vec4 gx11 = ixy11 * (1.0 / 7.0);\n    vec4 gy11 = floor(gx11) * (1.0 / 7.0);\n    vec4 gz11 = floor(gy11) * (1.0 / 6.0);\n    gx11 = fract(gx11) - 0.5;\n    gy11 = fract(gy11) - 0.5;\n    gz11 = fract(gz11) - 0.5;\n    vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);\n    vec4 sw11 = step(gw11, vec4(0.0));\n    gx11 -= sw11 * (step(0.0, gx11) - 0.5);\n    gy11 -= sw11 * (step(0.0, gy11) - 0.5);\n\n    vec4 g0000 = vec4(gx00.x,gy00.x,gz00.x,gw00.x);\n    vec4 g1000 = vec4(gx00.y,gy00.y,gz00.y,gw00.y);\n    vec4 g0100 = vec4(gx00.z,gy00.z,gz00.z,gw00.z);\n    vec4 g1100 = vec4(gx00.w,gy00.w,gz00.w,gw00.w);\n    vec4 g0010 = vec4(gx10.x,gy10.x,gz10.x,gw10.x);\n    vec4 g1010 = vec4(gx10.y,gy10.y,gz10.y,gw10.y);\n    vec4 g0110 = vec4(gx10.z,gy10.z,gz10.z,gw10.z);\n    vec4 g1110 = vec4(gx10.w,gy10.w,gz10.w,gw10.w);\n    vec4 g0001 = vec4(gx01.x,gy01.x,gz01.x,gw01.x);\n    vec4 g1001 = vec4(gx01.y,gy01.y,gz01.y,gw01.y);\n    vec4 g0101 = vec4(gx01.z,gy01.z,gz01.z,gw01.z);\n    vec4 g1101 = vec4(gx01.w,gy01.w,gz01.w,gw01.w);\n    vec4 g0011 = vec4(gx11.x,gy11.x,gz11.x,gw11.x);\n    vec4 g1011 = vec4(gx11.y,gy11.y,gz11.y,gw11.y);\n    vec4 g0111 = vec4(gx11.z,gy11.z,gz11.z,gw11.z);\n    vec4 g1111 = vec4(gx11.w,gy11.w,gz11.w,gw11.w);\n\n    vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));\n    g0000 *= norm00.x;\n    g0100 *= norm00.y;\n    g1000 *= norm00.z;\n    g1100 *= norm00.w;\n\n    vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));\n    g0001 *= norm01.x;\n    g0101 *= norm01.y;\n    g1001 *= norm01.z;\n    g1101 *= norm01.w;\n\n    vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));\n    g0010 *= norm10.x;\n    g0110 *= norm10.y;\n    g1010 *= norm10.z;\n    g1110 *= norm10.w;\n\n    vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));\n    g0011 *= norm11.x;\n    g0111 *= norm11.y;\n    g1011 *= norm11.z;\n    g1111 *= norm11.w;\n\n    float n0000 = dot(g0000, Pf0);\n    float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));\n    float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));\n    float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));\n    float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));\n    float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));\n    float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));\n    float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));\n    float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));\n    float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));\n    float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));\n    float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));\n    float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));\n    float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));\n    float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));\n    float n1111 = dot(g1111, Pf1);\n\n    vec4 fade_xyzw = quintic(Pf0);\n    vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);\n    vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);\n    vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);\n    vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);\n    float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);\n    return 2.2 * n_xyzw;\n}\n#endif\n\n#ifndef SRGB_EPSILON \n#define SRGB_EPSILON 0.00000001\n#endif\n\n#ifndef FNC_SRGB2RGB\n#define FNC_SRGB2RGB\n\nfloat srgb2rgb(float channel) {\n    return (channel < 0.04045) ? channel * 0.0773993808 : pow((channel + 0.055) * 0.947867298578199, 2.4);\n}\n\nvec3 srgb2rgb(vec3 srgb) {\n    return vec3(srgb2rgb(srgb.r + SRGB_EPSILON), \n                srgb2rgb(srgb.g + SRGB_EPSILON),\n                srgb2rgb(srgb.b + SRGB_EPSILON));\n}\n\nvec4 srgb2rgb(vec4 srgb) {\n    return vec4(srgb2rgb(srgb.rgb), srgb.a);\n}\n\n#endif\n\n#if !defined(FNC_SATURATE) && !defined(saturate)\n#define FNC_SATURATE\n#define saturate(x) clamp(x, 0.0, 1.0)\n#endif\n\n#ifndef SRGB_EPSILON \n#define SRGB_EPSILON 0.00000001\n#endif\n\n#ifndef FNC_RGB2SRGB\n#define FNC_RGB2SRGB\n\nfloat rgb2srgb(float channel) {\n    return (channel < 0.0031308) ? channel * 12.92 : 1.055 * pow(channel, 0.4166666666666667) - 0.055;\n}\n\nvec3 rgb2srgb(vec3 rgb) {\n    return saturate(vec3(rgb2srgb(rgb.r - SRGB_EPSILON), rgb2srgb(rgb.g - SRGB_EPSILON), rgb2srgb(rgb.b - SRGB_EPSILON)));\n}\n\nvec4 rgb2srgb(vec4 rgb) {\n    return vec4(rgb2srgb(rgb.rgb), rgb.a);\n}\n\n#endif\n\n#ifndef FNC_MIXOKLAB\n#define FNC_MIXOKLAB\nvec3 mixOklab( vec3 colA, vec3 colB, float h ) {\n\n    #ifdef MIXOKLAB_COLORSPACE_SRGB\n    colA = srgb2rgb(colA);\n    colB = srgb2rgb(colB);\n    #endif\n\n    const mat3 kCONEtoLMS = mat3(                \n         0.4121656120,  0.2118591070,  0.0883097947,\n         0.5362752080,  0.6807189584,  0.2818474174,\n         0.0514575653,  0.1074065790,  0.6302613616);\n    const mat3 kLMStoCONE = mat3(\n         4.0767245293, -1.2681437731, -0.0041119885,\n        -3.3072168827,  2.6093323231, -0.7034763098,\n         0.2307590544, -0.3411344290,  1.7068625689);\n\n    vec3 lmsA = pow( kCONEtoLMS * colA, vec3(1.0/3.0) );\n    vec3 lmsB = pow( kCONEtoLMS * colB, vec3(1.0/3.0) );\n    \n    vec3 lms = mix( lmsA, lmsB, h );\n\n    vec3 rgb = kLMStoCONE*(lms*lms*lms);\n\n    #ifdef MIXOKLAB_COLORSPACE_SRGB\n    return rgb2srgb(rgb);\n    #else\n    return rgb;\n    #endif\n}\n\nvec4 mixOklab( vec4 colA, vec4 colB, float h ) {\n    return vec4( mixOklab(colA.rgb, colB.rgb, h), mix(colA.a, colB.a, h) );\n}\n#endif\n\n\nfloat rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed)\n{\n    vec2 sourceToCoord = coord - raySource;\n    float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);\n    \n    // Calculate the diagonal length\n    float diagonal = length(u_resolution);\n\n    return clamp(\n        (.45 + 0.15 * sin(cosAngle * seedA + u_time * speed)) +\n        (0.3 + 0.2 * cos(-cosAngle * seedB + u_time * speed)),\n        u_reach, 1.0) *\n        clamp((diagonal - length(sourceToCoord)) / diagonal, u_reach, 1.0);\n}\n\nvoid main()\n{\n    vec2 uv = gl_FragCoord.xy / u_resolution.xy;\n    uv.y = 1.0 - uv.y;\n    vec2 coord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);\n    float speed = u_rays * 10.0;\n    \n    // Set the parameters of the sun rays\n    vec2 rayPos1 = u_rayPos1;\n    vec2 rayRefDir1 = normalize(vec2(1.0, -0.116));\n    float raySeedA1 = 36.2214*speed;\n    float raySeedB1 = 21.11349*speed;\n    float raySpeed1 = 1.5*speed;\n    \n    vec2 rayPos2 = u_rayPos2;\n    vec2 rayRefDir2 = normalize(vec2(1.0, 0.241));\n    float raySeedA2 = 22.39910*speed;\n    float raySeedB2 = 18.0234*speed;\n    float raySpeed2 = 1.1*speed;\n    \n    // Calculate ray strengths\n    float strength1 = rayStrength(rayPos1, rayRefDir1, coord, raySeedA1, raySeedB1, raySpeed1);\n    float strength2 = rayStrength(rayPos2, rayRefDir2, coord, raySeedA2, raySeedB2, raySpeed2);\n    \n    // Calculate brightness attenuation\n    float brightness = 1.0*u_reach - (coord.y / u_resolution.y);\n    float attenuation = clamp(brightness + (0.5 + u_intensity), 0.0, 1.0);\n    \n    // Calculate alpha values while preserving color\n    float alpha1 = strength1 * attenuation * u_colors[0].a;\n    float alpha2 = strength2 * attenuation * u_colors[1].a;\n    \n    // Pre-multiply the colors with their alpha values\n    vec3 premultColor1 = u_colors[0].rgb * alpha1;\n    vec3 premultColor2 = u_colors[1].rgb * alpha2;\n    \n    // Blend the pre-multiplied colors\n    vec3 blendedColor = premultColor1 + premultColor2;\n    float blendedAlpha = alpha1 + alpha2 * (1.0 - alpha1);\n    \n    // Un-premultiply the final color\n    vec3 finalRGB = blendedColor / max(blendedAlpha, 0.0001);\n    \n    gl_FragColor = vec4(finalRGB * blendedAlpha, blendedAlpha);\n}\n"
	function parseColor(c, el) {
		c = String(c || "#fff").trim()
		var m = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(c)
		if (m) c = (getComputedStyle(el).getPropertyValue(m[1]) || "").trim() || (m[2] || "#fff").trim()
		var r = 1, g = 1, b = 1, a = 1, p
		if ((p = /^rgba?\(([^)]+)\)/.exec(c))) { p = p[1].split(","); r = p[0] / 255; g = p[1] / 255; b = p[2] / 255; if (p[3] != null) a = parseFloat(p[3]) }
		else if (c[0] === "#") { var h = c.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; r = parseInt(h.slice(0, 2), 16) / 255; g = parseInt(h.slice(2, 4), 16) / 255; b = parseInt(h.slice(4, 6), 16) / 255 }
		return [r, g, b, a]
	}
	function lightRays() {
		if (!RAYS_FRAG) return
		var map = function (v, a, b, c, d) { return c + ((v - a) / (b - a)) * (d - c) }
		$$("[data-rays]").forEach(function (host) {
			var p
			try { p = JSON.parse(host.getAttribute("data-rays")) } catch (e) { return }
			var canvas = doc.createElement("canvas")
			canvas.style.cssText = "display:block;width:100%;height:100%"
			host.appendChild(canvas)
			var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true })
			if (!gl) return
			var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
			var prog = gl.createProgram()
			gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}"))
			gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision highp float;\n" + RAYS_FRAG))
			gl.linkProgram(prog)
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return }
			gl.useProgram(prog)
			var buf = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buf)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
			var loc = gl.getAttribLocation(prog, "p")
			gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
			var U = function (n) { return gl.getUniformLocation(prog, n) }
			var rc = p.raysColor || {}
			var c1 = parseColor(rc.mode === "multi" ? rc.color1 : rc.color, host), c2 = parseColor(rc.mode === "multi" ? rc.color2 : rc.color, host)
			gl.uniform4f(U("u_colors[0]"), c1[0], c1[1], c1[2], 1)
			gl.uniform4f(U("u_colors[1]"), c2[0], c2[1], c2[2], 1)
			gl.uniform1f(U("u_intensity"), map(p.intensity == null ? 50 : p.intensity, 0, 100, 0, 0.5))
			gl.uniform1f(U("u_rays"), map(p.rays == null ? 30 : p.rays, 0, 100, 0, 0.3))
			gl.uniform1f(U("u_reach"), map(p.reach == null ? 40 : p.reach, 0, 100, 0, 0.5))
			gl.uniform2f(U("u_mouse"), 0, 0)
			var pos = p.position == null ? 80 : p.position
			var w = 0, h = 0
			var resize = function () {
				var nw = host.clientWidth, nh = host.clientHeight
				if (nw === w && nh === h) return
				w = nw; h = nh; canvas.width = w; canvas.height = h
				gl.viewport(0, 0, w, h)
				gl.uniform2f(U("u_resolution"), w, h)
				gl.uniform2f(U("u_rayPos1"), (pos / 100) * w, -0.4 * h)
				gl.uniform2f(U("u_rayPos2"), (pos / 100 + 0.02) * w, -0.5 * h)
			}
			var anim = p.animation || { animate: true, speed: 10 }
			var time = Math.random() * 1e4, last = 0, visible = false, raf = 0
			var uTime = U("u_time")
			var draw = function (now) {
				raf = 0
				resize()
				if (last && anim.animate && !reduce) time += ((now - last) * anim.speed) / 1000 / 10
				last = now
				gl.uniform1f(uTime, time)
				gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
				gl.drawArrays(gl.TRIANGLES, 0, 6)
				if (visible && anim.animate && !reduce) raf = requestAnimationFrame(draw)
			}
			resize(); draw(0)
			if ("IntersectionObserver" in window) new IntersectionObserver(function (es) {
				visible = es[0].isIntersecting
				if (visible && !raf) { last = 0; raf = requestAnimationFrame(draw) }
			}).observe(host)
			addEventListener("resize", function () { if (!raf) requestAnimationFrame(draw) })
		})
	}

	/* ---------- 9c. cursor personalizado ---------- */
	function cursor() {
		var conf = FX.cursors || {}
		if (!Object.keys(conf).length || matchMedia("(any-hover: none)").matches) return
		var box = doc.createElement("div"), dot = doc.createElement("div")
		box.className = "fx-cursor"; dot.className = "fx-cursor-c"
		dot.innerHTML = '<p class="fx-cursor-t">' + (FX.cursorText || "Ver agora") + "</p>"
		box.appendChild(dot); doc.body.appendChild(box)
		var mx = 0, my = 0, x = 0, y = 0, vx = 0, vy = 0, cur = null, raf = 0, lastT = 0, shown = false
		var find = function (px, py) {
			var n = doc.elementFromPoint(px, py)
			while (n && n !== doc.body) { var id = n.getAttribute && n.getAttribute("data-framer-cursor"); if (id && conf[id]) return id; n = n.parentElement }
			return null
		}
		var place = function () {
			var c = conf[cur] || {}
			var al = { start: "0%", center: "-50%", end: "-100%" }[c.alignment || "center"]
			var t = { top: al + ", -100%", right: "0%, " + al, bottom: al + ", 0%", left: "-100%, " + al }[c.placement] || "-50%, -50%"
			var ox = (c.offset && c.offset.x) || 0, oy = (c.offset && c.offset.y) || 0
			box.style.transform = "translate3d(" + (x + ox) + "px," + (y + oy) + "px,0) translate(" + t + ")"
		}
		var step = function (now) {
			raf = 0
			var c = conf[cur] || {}, tr = c.transition
			var dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016)
			lastT = now
			if (!tr || tr.type !== "spring" || reduce) { x = mx; y = my; vx = vy = 0 }
			else {
				var k = tr.stiffness || 400, d = tr.damping || 60, m = tr.mass || 1
				for (var i = 0; i < 4; i++) {
					var h = dt / 4
					vx += ((-k * (x - mx) - d * vx) / m) * h; x += vx * h
					vy += ((-k * (y - my) - d * vy) / m) * h; y += vy * h
				}
			}
			place()
			if (Math.abs(x - mx) > 0.1 || Math.abs(y - my) > 0.1) raf = requestAnimationFrame(step)
			else lastT = 0
		}
		var setCursor = function (id) {
			if (id === cur) return
			var prev = conf[cur] || {}
			cur = id
			var c = conf[id] || null
			box.classList.toggle("on", !!c && shown)
			var hide = !!c && !c.placement && !c.alignment
			doc.body.classList.toggle("framer-cursor-none", hide)
			dot.classList.toggle("hover", !!c && c.variant !== "VKeZmVTKZ")
			if (!prev.transition && c && c.transition) { x = mx; y = my }
		}
		addEventListener("pointermove", function (e) {
			if (e.pointerType === "touch") return
			mx = e.clientX; my = e.clientY
			if (!shown) { shown = true; x = mx; y = my }
			setCursor(find(mx, my))
			box.classList.toggle("on", !!conf[cur])
			if (!raf) raf = requestAnimationFrame(step)
		}, { passive: true })
		addEventListener("scroll", function () { if (shown) setCursor(find(mx, my)) }, { passive: true })
		doc.addEventListener("mouseleave", function () { box.classList.remove("on"); shown = false })
		addEventListener("blur", function () { box.classList.remove("on"); shown = false })
		addEventListener("pointerdown", function (e) { if (e.pointerType !== "touch") dot.classList.add("pressed") })
		addEventListener("pointerup", function () { dot.classList.remove("pressed") })
	}

	/* ---------- 10. lightbox ---------- */
	function lightbox() {
		var box = null
		doc.addEventListener("click", function (ev) {
			var t = ev.target.closest("[data-lightbox]")
			if (!t) return
			ev.preventDefault()
			var src = t.getAttribute("data-lightbox")
			box = doc.createElement("div")
			box.className = "lb"
			box.innerHTML = '<img alt="" src="' + src + '"><button aria-label="Fechar">×</button>'
			doc.body.appendChild(box)
			requestAnimationFrame(function () { box.classList.add("on") })
			var close = function () { box.classList.remove("on"); var b = box; setTimeout(function () { b.remove() }, 300) }
			box.addEventListener("click", close)
			doc.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); doc.removeEventListener("keydown", k) } })
		})
	}

	/* ---------- 11. formulários → WhatsApp ---------- */
	function forms() {
		// estado "vazio" dos campos (o Framer usa para a cor do placeholder)
		$$(".framer-form-input").forEach(function (i) {
			var upd = function () { i.classList.toggle("framer-form-input-empty", !i.value) }
			i.addEventListener("input", upd); i.addEventListener("change", upd); upd()
		})
		// vídeos do YouTube só carregam ao clicar
		$$("[data-yt]").forEach(function (box) {
			box.addEventListener("click", function () {
				box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + box.getAttribute("data-yt") + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Vídeo"></iframe>'
			}, { once: true })
		})
		$$("form[data-whatsapp]").forEach(function (f) {
			f.addEventListener("submit", function (ev) {
				ev.preventDefault()
				if (f.reportValidity && !f.reportValidity()) return
				var lines = [f.getAttribute("data-whatsapp-intro") || "Olá! Vim pelo site da Time."]
				$$("input, select, textarea", f).forEach(function (i) {
					if (!i.name || i.type === "submit" || !i.value) return
					lines.push("*" + i.name + ":* " + i.value)
				})
				var url = "https://wa.me/" + f.getAttribute("data-whatsapp") + "?text=" + encodeURIComponent(lines.join("\n"))
				window.open(url, "_blank", "noopener")
			})
		})
	}

	/* ---------- 11b. grade "masonry" (preenche linha a linha, na coluna mais curta) ---------- */
	function masonry() {
		$$("[data-masonry]").forEach(function (box) {
			var items = Array.prototype.slice.call(box.children)
			var cols = 0
			var layout = function () {
				var n = innerWidth < 810 ? 1 : innerWidth < 1200 ? 2 : 3
				if (n === cols) return
				cols = n
				box.innerHTML = ""
				var colEls = [], heights = []
				for (var i = 0; i < n; i++) { var c = doc.createElement("div"); c.className = "tm-col"; box.appendChild(c); colEls.push(c); heights.push(0) }
				items.forEach(function (it) {
					var k = heights.indexOf(Math.min.apply(null, heights))
					colEls[k].appendChild(it)
					var img = it.querySelector("img")
					var ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : +(img && img.getAttribute("data-ratio")) || 1
					heights[k] += ratio + 0.15
				})
			}
			layout()
			addEventListener("resize", layout)
		})
	}

	/* ---------- 12. blocos próprios que aparecem ao rolar ---------- */
	function reveals() {
		$$("[data-reveal]").forEach(function (el) { inView(el, 0.3, function () { el.classList.add("is-in") }) })
	}

	function start() {
		doc.documentElement.classList.add("js")
		var safe = function (fn) { try { fn() } catch (e) { console.warn(e) } }
		;[appearOnLoad, textEffects, transformOnView, loops, scrollDirection, hoverVariants, revealText, variantToggles, tickers, lightRays, cursor, lightbox, forms, masonry, reveals].forEach(safe)
	}
	if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start)
	else start()
})()
