// Small motion helpers that reproduce Framer's spring and tween transitions with the Web Animations API.
const springCache = new Map()

// Returns { duration (ms), easing: "linear(...)" } for a Framer/framer-motion spring.
export function springToEasing(t) {
	let { stiffness, damping, mass = 1, duration, bounce } = t
	if (stiffness == null) {
		// time based spring (duration + bounce), same idea as framer-motion's findSpring
		const d = Math.max(0.05, duration ?? 0.4)
		const zeta = Math.min(1, Math.max(0.05, 1 - (bounce ?? 0.25)))
		const w0 = (zeta >= 1 ? 6.6 : 5.2 / zeta) / d
		stiffness = w0 * w0 * mass
		damping = 2 * zeta * Math.sqrt(stiffness * mass)
	}
	const key = `${stiffness}|${damping}|${mass}`
	if (springCache.has(key)) return springCache.get(key)
	const w0 = Math.sqrt(stiffness / mass)
	const zeta = damping / (2 * Math.sqrt(stiffness * mass))
	const x = (s) => {
		if (zeta < 1) {
			const wd = w0 * Math.sqrt(1 - zeta * zeta)
			return 1 - Math.exp(-zeta * w0 * s) * (Math.cos(wd * s) + ((zeta * w0) / wd) * Math.sin(wd * s))
		}
		if (zeta === 1) return 1 - Math.exp(-w0 * s) * (1 + w0 * s)
		const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1)), r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1))
		return 1 - (r2 * Math.exp(r1 * s) - r1 * Math.exp(r2 * s)) / (r2 - r1)
	}
	// find settle time
	let end = 0.1
	for (let s = 0; s < 10; s += 0.01) {
		let settled = true
		for (let k = s; k < s + 0.3; k += 0.02) if (Math.abs(1 - x(k)) > 0.0015) { settled = false; break }
		if (settled) { end = Math.max(s, 0.1); break }
		end = s
	}
	const N = 48, pts = []
	for (let i = 0; i <= N; i++) { const v = i === N ? 1 : x((end * i) / N); pts.push(+v.toFixed(4)) }
	const out = { duration: Math.round(end * 1000), easing: `linear(${pts.join(",")})` }
	springCache.set(key, out)
	return out
}

export function timing(tr = {}) {
	const delay = Math.round((tr.delay || 0) * 1000)
	if (tr.type === "tween" || tr.ease || (tr.duration != null && tr.type !== "spring")) {
		const e = Array.isArray(tr.ease) ? `cubic-bezier(${tr.ease.join(",")})` : tr.ease === "linear" ? "linear" : "cubic-bezier(0.44,0,0.56,1)"
		return { duration: Math.round((tr.duration ?? 0.3) * 1000), easing: e, delay }
	}
	const s = springToEasing(tr)
	return { duration: s.duration, easing: s.easing, delay }
}

const num = (v, d = 0) => (v == null || v === "" ? d : parseFloat(v))
export function transformOf(s = {}) {
	const parts = []
	const x = num(s.x), y = num(s.y)
	if (x || y) parts.push(`translate(${x}px, ${y}px)`)
	if (s.translateZ) parts.push(`translateZ(${num(s.translateZ)}px)`)
	const sc = s.scale == null ? 1 : num(s.scale, 1)
	if (sc !== 1) parts.push(`scale(${sc})`)
	if (num(s.rotate)) parts.push(`rotate(${num(s.rotate)}deg)`)
	if (num(s.rotateX)) parts.push(`rotateX(${num(s.rotateX)}deg)`)
	if (num(s.rotateY)) parts.push(`rotateY(${num(s.rotateY)}deg)`)
	if (num(s.skewX)) parts.push(`skewX(${num(s.skewX)}deg)`)
	if (num(s.skewY)) parts.push(`skewY(${num(s.skewY)}deg)`)
	return parts.length ? parts.join(" ") : "none"
}
