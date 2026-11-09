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

	/* ---------- 3. entrada ao rolar (style transform on in view) ---------- */
	function transformOnView() {
		Object.keys(FX.el).forEach(function (cls) {
			FX.el[cls].forEach(function (e) {
				if (!e.__framer__transformTargets || e.__framer__transformTrigger !== "onInView") return
				var t = e.__framer__transformTargets, from = t[0] && t[0].target, to = t[t.length - 1] && t[t.length - 1].target
				if (!from || !to) return
				var tr = e.__framer__spring || { type: "spring", stiffness: 200, damping: 60, mass: 1 }
				byClass(cls).forEach(function (el) {
					if (!below(el)) return
					var f = frame(from), g = frame(to)
					el.style.transform = f.transform; if (f.opacity != null) el.style.opacity = f.opacity
					inView(el, 0.1, function () { play(el, f, g, tr) })
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
	function toggles() {
		$$("[data-toggle-open]").forEach(function (box) {
			var tplOpen = box.querySelector("template[data-state=open]"), tplClosed = box.querySelector("template[data-state=closed]")
			if (!tplOpen || !tplClosed) return
			var holder = box.querySelector("[data-toggle-body]")
			var open = false
			box.addEventListener("click", function (ev) {
				var trigger = box.getAttribute("data-toggle-trigger")
				if (trigger && !ev.target.closest(trigger)) return
				if (ev.target.closest("a[href]") && open && !ev.target.closest(trigger || "*")) return
				var h0 = holder.offsetHeight
				open = !open
				holder.innerHTML = (open ? tplOpen : tplClosed).innerHTML
				var h1 = holder.offsetHeight
				if (!reduce && h0 !== h1) holder.animate([{ height: h0 + "px", overflow: "hidden" }, { height: h1 + "px", overflow: "hidden" }], { duration: 380, easing: "cubic-bezier(0.22,1,0.36,1)" })
				box.setAttribute("aria-expanded", open)
			})
		})
	}

	/* ---------- 9. carrossel infinito (Ticker) ---------- */
	function tickers() {
		$$("[data-ticker]").forEach(function (list) {
			var speed = +list.getAttribute("data-ticker") || 50, vertical = list.getAttribute("data-ticker-dir") === "y"
			var items = Array.prototype.slice.call(list.children)
			if (!items.length) return
			var size = vertical ? list.scrollHeight : list.scrollWidth
			var gap = parseFloat(getComputedStyle(list).gap) || 0
			var span = size + gap
			var reps = Math.max(1, Math.ceil(((vertical ? list.parentElement.offsetHeight : list.parentElement.offsetWidth) * 2) / Math.max(1, span)))
			for (var r = 0; r < reps; r++) items.forEach(function (it) { var c = it.cloneNode(true); c.setAttribute("aria-hidden", "true"); list.appendChild(c) })
			if (reduce) return
			var axis = vertical ? "translateY" : "translateX"
			list.animate([{ transform: axis + "(0)" }, { transform: axis + "(-" + span + "px)" }], { duration: (span / speed) * 1000, iterations: Infinity })
		})
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

	/* ---------- 12. blocos próprios que aparecem ao rolar ---------- */
	function reveals() {
		$$("[data-reveal]").forEach(function (el) { inView(el, 0.3, function () { el.classList.add("is-in") }) })
	}

	function start() {
		doc.documentElement.classList.add("js")
		var safe = function (fn) { try { fn() } catch (e) { console.warn(e) } }
		;[appearOnLoad, textEffects, transformOnView, loops, scrollDirection, hoverVariants, revealText, toggles, tickers, lightbox, forms, reveals].forEach(safe)
	}
	if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start)
	else start()
})()
