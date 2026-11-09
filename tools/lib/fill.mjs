// Breakpoint helpers + filling parts that Framer only renders in the browser (icons, code components)
// by aligning the server HTML with the DOM captured after the page ran in a real browser.
import * as cheerio from "cheerio"

export function hiddenClasses(html) {
	const map = {}
	const re = /@media([^{]+)\{\s*((?:\.hidden-[a-z0-9]+\s*,?\s*)+)\{\s*display:\s*none\s*!important;?\s*\}\s*\}/g
	let m
	while ((m = re.exec(html))) for (const c of m[2].match(/hidden-[a-z0-9]+/g)) map[c] = m[1].trim()
	return map
}

export function mqMatches(mq, w) {
	const min = mq.match(/min-width:\s*([\d.]+)px/), max = mq.match(/max-width:\s*([\d.]+)px/)
	if (min && w < +min[1]) return false
	if (max && w > +max[1]) return false
	return true
}

const isHidden = ($el, w, hidden) => ($el.attr("class") || "").split(/\s+/).some((c) => hidden[c] && mqMatches(hidden[c], w))

export function visibleKids($, node, w, hidden) {
	const out = []
	$(node).children().each((_, c) => {
		if (c.tagName === "script" || c.tagName === "style" || c.tagName === "template") return
		const $c = $(c)
		if (isHidden($c, w, hidden)) return
		if ($c.hasClass("ssr-variant")) out.push(...visibleKids($, c, w, hidden))
		else out.push(c)
	})
	return out
}

const keyOf = ($, el) => {
	const cls = ($(el).attr("class") || "").split(/\s+/).find((c) => c.startsWith("framer-") && !/^framer-(v-|styles-|text$)/.test(c)) || ""
	return el.tagName + "." + cls
}

const isEmpty = ($, el) => $(el).children().length === 0 && !$(el).text().trim()

// Copies browser-rendered content into empty server-rendered nodes. Returns number of fills.
export function fillFromHydrated($s, $h, w, hidden) {
	let fills = 0
	const kidsH = (n) => visibleKids($h, n, w, hidden)
	const kidsS = (n) => visibleKids($s, n, w, hidden)
	function align(sNode, hNode, depth) {
		const sk = kidsS(sNode)
		const hk = kidsH(hNode)
		let j = 0
		for (const s of sk) {
			const ks = keyOf($s, s)
			let found = -1
			for (let k = j; k < Math.min(hk.length, j + 8); k++) if (keyOf($h, hk[k]) === ks) { found = k; break }
			if (found < 0) continue
			const h = hk[found]
			j = found + 1
			if (isEmpty($s, s)) {
				if ($h(h).children().length) { $s(s).html($h(h).html()); fills++ }
			} else if (depth < 80) align(s, h, depth + 1)
		}
	}
	align($s("#main")[0], $h("#main")[0], 0)
	return fills
}

export const load = (html) => cheerio.load(html, { decodeEntities: false })
