// Troca a paleta do template (verde-oliva, limão neon e roxo) pelas cores oficiais da marca Time.
// Paleta da marca: #222B28 (verde profundo) · #4C5E58 (verde acinzentado) · #DDFF93 (verde claro)
//                  #BAC18D (sálvia) · #FDFFF8 (off-white)
// A regra é por tom: os escuros esverdeados/arroxeados viram o verde profundo da marca (mesma luminosidade),
// os verdes vivos viram o #DDFF93 e os verdes médios a sálvia.

const BRAND_DARK_H = 160, BRAND_DARK_S = 0.12

function rgbToHsl(r, g, b) {
	r /= 255; g /= 255; b /= 255
	const max = Math.max(r, g, b), min = Math.min(r, g, b)
	let h = 0, s = 0
	const l = (max + min) / 2
	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
		else if (max === g) h = (b - r) / d + 2
		else h = (r - g) / d + 4
		h *= 60
	}
	return [h, s, l]
}
function hslToRgb(h, s, l) {
	h /= 360
	if (!s) return [l, l, l].map((v) => Math.round(v * 255))
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
	const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p }
	return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255))
}

export function mapColor(r, g, b, alpha) {
	const [h, s, l] = rgbToHsl(r, g, b)
	// pretos opacos (fundos) ganham o tom verde profundo da marca; pretos transparentes (sombras) ficam
	if (s < 0.1 && l < 0.09 && (alpha == null || alpha >= 0.95)) return hslToRgb(BRAND_DARK_H, 0.16, l * 0.6 + 0.04)
	if (s < 0.1 || l > 0.97) return null // demais neutros (cinza, branco) ficam
	const yellowGreen = h >= 50 && h <= 115
	const purple = h >= 240 && h <= 310
	const teal = h > 115 && h < 200
	// verdes vivos (limão neon do template) -> verde claro da marca
	if ((yellowGreen || purple) && l >= 0.55 && s >= 0.45) return [221, 255, 147]
	// verdes claros apagados -> sálvia
	if (yellowGreen && l >= 0.55) return [186, 193, 141]
	// tons médios e escuros (oliva, roxo do template) -> família do verde profundo da marca
	if (yellowGreen || purple || teal) return hslToRgb(BRAND_DARK_H, Math.min(BRAND_DARK_S, s), l)
	return null
}

const hex2 = (n) => n.toString(16).padStart(2, "0")
export function recolor(text) {
	// rgb()/rgba()
	text = text.replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/g, (m, r, g, b, a) => {
		const al = a == null ? null : a.endsWith("%") ? parseFloat(a) / 100 : +a
		const c = mapColor(+r, +g, +b, al)
		if (!c) return m
		return a != null ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})` : `rgb(${c[0]}, ${c[1]}, ${c[2]})`
	})
	// #rgb, #rgba, #rrggbb, #rrggbbaa (só em contexto de cor: depois de ":", ",", "(" ou espaço)
	text = text.replace(/([:,(\s])#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g, (m, pre, hx) => {
		let x = hx
		if (x.length <= 4) x = x.split("").map((y) => y + y).join("")
		const r = parseInt(x.slice(0, 2), 16), g = parseInt(x.slice(2, 4), 16), b = parseInt(x.slice(4, 6), 16)
		const a = x.length === 8 ? x.slice(6, 8) : ""
		const c = mapColor(r, g, b, a ? parseInt(a, 16) / 255 : null)
		if (!c) return m
		return pre + "#" + c.map(hex2).join("") + a
	})
	// branco da marca
	return text.replace(/#fafff3\b/gi, "#fdfff8").replace(/rgb\(250, 255, 243\)/g, "rgb(253, 255, 248)")
}
