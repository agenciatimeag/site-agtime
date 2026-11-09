// Gera o site estático (pasta site/) a partir da captura do Framer + conteúdo atualizado.
// Uso: node tools/build.mjs
import fs from "node:fs"
import path from "node:path"
import { hiddenClasses, fillFromHydrated, load, mqMatches } from "./lib/fill.mjs"
import { rewriteAssetUrls, stripFramerRuntime } from "./lib/html.mjs"
import { patchCommon, patchPage } from "./patches.mjs"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const OUT = path.join(ROOT, "site")
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "capture/effects.json"), "utf8"))
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8")
const exists = (p) => fs.existsSync(path.join(ROOT, p))

export const PAGES = [
	{ id: "home", out: "index.html" },
	{ id: "sobre", out: "sobre/index.html" },
	{ id: "portfolio", out: "portfolio/index.html" },
	{ id: "contato", out: "contato/index.html" },
	{ id: "404", out: "404.html" },
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
	const comps = FX.components.filter((c) => c.enabledGestures && c.scopes.some((s) => present.has(s))).map((c) => ({ scopes: c.scopes, variantClassNames: c.variantClassNames, enabledGestures: c.enabledGestures, defaultVariant: c.defaultVariant }))
	return { el, comps }
}

export function buildPage(id, mutate) {
	const raw = read(`capture/raw/${id}.html`)
	const hidden = hiddenClasses(raw)
	const $ = load(raw)
	const stats = { fills: 0 }
	for (const w of [1440, 810, 390]) {
		const f = `capture/hydrated/${id}-${w}.html`
		if (!exists(f)) continue
		stats.fills += fillFromHydrated($, load(read(f)), w, hidden)
	}
	const ctx = { $, hidden, id, visibleAt: (el, w) => !$(el).parents().addBack().toArray().some((n) => ($(n).attr("class") || "").split(/\s+/).some((c) => hidden[c] && mqMatches(hidden[c], w))) }
	patchCommon(ctx)
	patchPage(ctx)
	if (mutate) mutate(ctx)
	stripFramerRuntime($)
	const fx = fxFor($)
	$("head").append(`\n<link rel="stylesheet" href="/_site/site.css">\n<script type="application/json" id="fx-data">${JSON.stringify(fx).replace(/</g, "\\u003c")}</script>\n<script src="/_site/site.js" defer></script>\n`)
	const missing = new Set()
	let html = rewriteAssetUrls($.html(), missing)
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
	fs.copyFileSync(path.join(ROOT, "tools/runtime/site.js"), path.join(OUT, "_site/site.js"))
	fs.writeFileSync(path.join(OUT, "_site/site.css"), read("tools/runtime/site.css") + "\n" + read("tools/snippets/portal.css") + (exists("tools/runtime/extra.css") ? "\n" + read("tools/runtime/extra.css") : ""))
	const allMissing = new Set()
	for (const p of PAGES) {
		if (!exists(`capture/raw/${p.id}.html`)) { console.log("skip", p.id); continue }
		const { html, missing, stats } = buildPage(p.id)
		missing.forEach((m) => allMissing.add(m))
		write(p.out, html)
		console.log(p.id, "->", p.out, Math.round(html.length / 1024) + "KB", "fills", stats.fills)
	}
	const { buildPortfolioDetails } = await import("./portfolio.mjs")
	for (const r of buildPortfolioDetails(buildPage)) { r.missing.forEach((m) => allMissing.add(m)); write(r.out, r.html) }
	if (allMissing.size) console.log("asset URLs not captured:", allMissing.size, [...allMissing].slice(0, 8))
}
