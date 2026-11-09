// Gera o site estático (pasta site/) a partir da captura do Framer + conteúdo atualizado.
// Uso: node tools/build.mjs
import fs from "node:fs"
import path from "node:path"
import { hiddenClasses, fillFromHydrated, load, mqMatches } from "./lib/fill.mjs"
import { rewriteAssetUrls, stripFramerRuntime } from "./lib/html.mjs"
import { patchCommon, patchPage } from "./patches.mjs"
import "./pages.mjs"
import { applyFixes } from "./fixes.mjs"
import { optimizeHtml } from "./lib/optimize.mjs"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const OUT = path.join(ROOT, "public")
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "capture/effects.json"), "utf8"))
const COMPONENTS = JSON.parse(fs.readFileSync(path.join(ROOT, "capture/components.json"), "utf8"))
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8")
const exists = (p) => fs.existsSync(path.join(ROOT, p))

export const PAGES = [
	{ id: "home", out: "index.html", path: "/" },
	{ id: "sobre", out: "sobre/index.html", path: "/sobre" },
	{ id: "portfolio", out: "portfolio/index.html", path: "/portfolio" },
	{ id: "contato", out: "contato/index.html", path: "/contato" },
	{ id: "404", out: "404.html", path: "/404" },
]

function fxFor($) {
	const present = new Set()
	$("[class]").each((_, el) => { for (const c of ($(el).attr("class") || "").split(/\s+/)) if (c.startsWith("framer-")) present.add(c) })
	const el = {}
	for (const [c, list] of Object.entries(FX.elements)) {
		if (!present.has(c)) continue
		const keep = list.map((e) => {
			const o = {}
			for (const [k, v] of Object.entries(e)) if (!["m", "data-framer-name", "layoutDependency", "style", "animate", "initial", "data-framer-appear-id"].includes(k)) o[k] = v
			return o
		}).filter((o) => Object.keys(o).some((k) => k !== "comp"))
		if (keep.length) el[c] = keep
	}
	const cursorIds = new Set($("[data-framer-cursor]").map((_, n) => $(n).attr("data-framer-cursor")).get())
	const cursors = {}
	for (const id of cursorIds) if (COMPONENTS.cursors[id]) cursors[id] = COMPONENTS.cursors[id]
	const comps = FX.components.filter((c) => c.enabledGestures && c.scopes.some((s) => present.has(s))).map((c) => ({ scopes: c.scopes, variantClassNames: c.variantClassNames, enabledGestures: c.enabledGestures, defaultVariant: c.defaultVariant }))
	return { el, comps, cursors }
}

export function buildPage(id, mutate, pagePath) {
	const raw = read(`capture/raw/${id}.html`)
	const hidden = hiddenClasses(raw)
	const $ = load(raw)
	const stats = { fills: 0 }
	for (const w of [1440, 810, 390]) {
		const f = `capture/hydrated/${id}-${w}.html`
		if (!exists(f)) continue
		stats.fills += fillFromHydrated($, load(read(f)), w, hidden)
	}
	const ctx = { $, hidden, id, path: pagePath || "/", visibleAt: (el, w) => !$(el).parents().addBack().toArray().some((n) => ($(n).attr("class") || "").split(/\s+/).some((c) => hidden[c] && mqMatches(hidden[c], w))) }
	patchCommon(ctx)
	patchPage(ctx)
	if (mutate) mutate(ctx)
	applyFixes(ctx)
	// códigos personalizados do site (ex.: Microsoft Clarity) ficam
	const snippets = [...raw.matchAll(/<!-- Snippet: \S+ -->([\s\S]*?)<!-- SnippetEnd/g)].map((m) => m[1].trim())
	stripFramerRuntime($)
	if (snippets.length) $("body").append("\n" + snippets.join("\n") + "\n")
	const fx = fxFor($)
	$("head").append(`\n<link rel="stylesheet" href="/_site/site.css">\n<script type="application/json" id="fx-data">${JSON.stringify(fx).replace(/</g, "\\u003c")}</script>\n<script src="/_site/site.js" defer></script>\n`)
	const missing = new Set()
	let html = rewriteAssetUrls($.html(), missing)
	// og:image precisa de URL absoluta
	html = html.replace(/(<meta [^>]*content=")(\/_assets\/[^"]+)("[^>]*data-abs-asset="1")/g, "$1https://www.agtime.com.br$2$3").replace(/ data-abs-asset="1"/g, "")
	html = html.replace(/<!--\$-->|<!--\/\$-->/g, "")
	return { html, missing, stats }
}

function write(rel, html) {
	const f = path.join(OUT, rel)
	fs.mkdirSync(path.dirname(f), { recursive: true })
	fs.writeFileSync(f, html)
}

if (process.argv[1] && process.argv[1].endsWith("build.mjs")) {
	fs.mkdirSync(path.join(OUT, "_site"), { recursive: true })
	fs.writeFileSync(path.join(OUT, "_site/site.js"), read("tools/runtime/site.js").replace('/*RAYS_FRAG*/ ""', JSON.stringify(read("tools/runtime/lightrays.frag"))))
	fs.writeFileSync(path.join(OUT, "_site/site.css"), read("tools/runtime/site.css") + "\n" + read("tools/snippets/portal.css") + (exists("tools/runtime/extra.css") ? "\n" + read("tools/runtime/extra.css") : ""))
	const allMissing = new Set()
	for (const p of PAGES) {
		if (!exists(`capture/raw/${p.id}.html`)) { console.log("skip", p.id); continue }
		const { html, missing, stats } = buildPage(p.id, null, p.path)
		missing.forEach((m) => allMissing.add(m))
		write(p.out, await optimizeHtml(html))
		console.log(p.id, "->", p.out, Math.round(html.length / 1024) + "KB", "fills", stats.fills)
	}
	const { buildPortfolioDetails } = await import("./portfolio.mjs")
	for (const r of buildPortfolioDetails(buildPage)) { r.missing.forEach((m) => allMissing.add(m)); write(r.out, await optimizeHtml(r.html)) }
	// robots.txt e sitemap.xml (o Framer gerava sozinho)
	const SITE = "https://www.agtime.com.br"
	const { PROJECTS } = await import("./portfolio.mjs")
	const urls = ["/", "/sobre", "/portfolio", "/contato", ...PROJECTS.map((p) => "/portfolio/" + p.slug)]
	const today = new Date().toISOString().slice(0, 10)
	fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`)
	fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
	if (allMissing.size) console.log("asset URLs not captured:", allMissing.size, [...allMissing].slice(0, 8))
}
