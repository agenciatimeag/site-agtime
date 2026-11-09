// Gera versões WebP menores das imagens grandes e troca src/srcset nas páginas.
// As versões ficam em public/_assets/opt/ (geradas uma vez; reaproveitadas nos próximos builds).
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import * as cheerio from "cheerio"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const PUB = path.join(ROOT, "public")
const OPT = path.join(PUB, "_assets/opt")
const WIDTHS = [480, 960, 1600]
const MIN_BYTES = 120 * 1024
const meta = new Map()

async function variants(rel) {
	if (meta.has(rel)) return meta.get(rel)
	const file = path.join(PUB, rel)
	let out = null
	try {
		const st = fs.statSync(file)
		if (st.size >= MIN_BYTES && /\.(jpe?g|png|webp)$/i.test(rel)) {
			const info = await sharp(file).metadata()
			const base = path.basename(rel).replace(/\.[a-z]+$/i, "")
			const ws = WIDTHS.filter((w) => w < info.width)
			if (!ws.length || ws[ws.length - 1] < Math.min(info.width, 1600)) ws.push(Math.min(info.width, 1600))
			out = []
			for (const w of [...new Set(ws)]) {
				const name = `${base}-${w}.webp`
				const dest = path.join(OPT, name)
				if (!fs.existsSync(dest)) {
					fs.mkdirSync(OPT, { recursive: true })
					await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest)
				}
				out.push({ w, url: `/_assets/opt/${name}` })
			}
		}
	} catch {}
	meta.set(rel, out)
	return out
}

export async function optimizeHtml(html) {
	const $ = cheerio.load(html, { decodeEntities: false })
	const imgs = $("img[src^='/_assets/images/']").toArray()
	for (const img of imgs) {
		const $i = $(img)
		const v = await variants($i.attr("src").split("?")[0])
		if (!v) continue
		const mid = v.find((x) => x.w >= 960) || v[v.length - 1]
		$i.attr("src", mid.url)
		$i.attr("srcset", v.map((x) => `${x.url} ${x.w}w`).join(", "))
		if (!$i.attr("sizes")) $i.attr("sizes", $i.closest(".tm-masonry, .tm-grid").length ? "(min-width: 1200px) 400px, (min-width: 810px) 50vw, 100vw" : "(min-width: 810px) 50vw, 100vw")
		if (!$i.attr("loading") && !$i.closest("header, nav").length) $i.attr("loading", "lazy")
	}
	// lightbox: abre a versão grande otimizada
	for (const a of $("a[data-lightbox^='/_assets/images/']").toArray()) {
		const $a = $(a)
		const v = await variants($a.attr("data-lightbox").split("?")[0])
		if (!v) continue
		const big = v[v.length - 1].url
		$a.attr({ href: big, "data-lightbox": big })
	}
	return $.html()
}
