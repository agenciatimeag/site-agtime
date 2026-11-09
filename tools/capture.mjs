// Captures the live Framer site so it can be rebuilt as a static site.
// Runs inside GitHub Actions (needs internet). Reads capture/request.json.
import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { chromium } from "playwright"

const ROOT = process.cwd()
const req = JSON.parse(await fs.readFile(path.join(ROOT, "capture/request.json"), "utf8"))
const BASE = req.base.replace(/\/$/, "")
const OUT = path.join(ROOT, "capture")
const ASSET_DIR = path.join(ROOT, "public/_assets")
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

const mk = (p) => fs.mkdir(p, { recursive: true })
await Promise.all(["raw", "js", "shots", "hydrated"].map((d) => mk(path.join(OUT, d))))
await mk(ASSET_DIR)

const nameFor = (p) => (p === "/" ? "home" : decodeURIComponent(p).replace(/^\//, "").replace(/[^\w.-]+/g, "_"))

async function get(url, asText = true, tries = 3) {
	for (let i = 0; i < tries; i++) {
		try {
			const r = await fetch(url, { headers: { "user-agent": UA } })
			if (!r.ok) throw new Error(`HTTP ${r.status}`)
			return asText ? await r.text() : Buffer.from(await r.arrayBuffer())
		} catch (e) {
			if (i === tries - 1) throw e
			await new Promise((r) => setTimeout(r, 800 * (i + 1)))
		}
	}
}

async function pool(items, n, fn) {
	const out = []
	let i = 0
	await Promise.all(Array.from({ length: n }, async () => {
		while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) }
	}))
	return out
}

// 1) Raw SSR HTML
const pages = req.pages
const rawHtml = {}
for (const p of pages) {
	try {
		const html = await get(BASE + encodeURI(p))
		rawHtml[p] = html
		await fs.writeFile(path.join(OUT, "raw", nameFor(p) + ".html"), html)
		console.log("raw", p, html.length)
	} catch (e) { console.log("raw FAIL", p, String(e)) }
}

// 2) Assets referenced in HTML (+ extra list)
const assetRe = /https:\/\/(?:framerusercontent\.com\/(?:images|assets|third-party-assets)\/[^"'\s)<>\\,]+|fonts\.gstatic\.com\/[^"'\s)<>\\]+)/g
const urls = new Set(req.extraAssets || [])
for (const html of Object.values(rawHtml)) for (const m of html.matchAll(assetRe)) urls.add(m[0].replace(/&amp;/g, "&"))
const manifest = {}
const list = [...urls]
await pool(list, 10, async (u) => {
	try {
		const U = new URL(u)
		const ext = path.extname(U.pathname) || ".bin"
		const base = path.basename(U.pathname, ext).replace(/[^\w-]/g, "").slice(0, 40)
		const q = U.search ? "-" + crypto.createHash("md5").update(U.search).digest("hex").slice(0, 8) : ""
		const sub = U.hostname.includes("gstatic") ? "fonts" : U.pathname.split("/")[1]
		const rel = `${sub}/${base}${q}${ext}`
		const file = path.join(ASSET_DIR, rel)
		await mk(path.dirname(file))
		try { await fs.access(file) } catch { await fs.writeFile(file, await get(u, false)) }
		manifest[u] = "/_assets/" + rel
	} catch (e) { console.log("asset FAIL", u, String(e)) }
})
await fs.writeFile(path.join(OUT, "assets.json"), JSON.stringify(manifest, null, 1))
console.log("assets", Object.keys(manifest).length, "/", list.length)

// 3) JS modules (to read animation settings later)
const jsSeen = new Map()
const jsQueue = []
const jsRe = /https:\/\/(?:framerusercontent\.com|framer\.com\/m|app\.framerstatic\.com)\/[^"'\s)<>\\]+?\.m?js\b/g
for (const html of Object.values(rawHtml)) for (const m of html.matchAll(jsRe)) jsQueue.push(m[0])
while (jsQueue.length && jsSeen.size < 600) {
	const u = jsQueue.shift()
	if (jsSeen.has(u)) continue
	try {
		const src = await get(u)
		const file = "js/" + crypto.createHash("md5").update(u).digest("hex").slice(0, 10) + ".mjs"
		jsSeen.set(u, file)
		await fs.writeFile(path.join(OUT, file), src)
		for (const m of src.matchAll(/["'`](\.{1,2}\/[^"'`\s]+?\.m?js)["'`]/g)) jsQueue.push(new URL(m[1], u).href)
		for (const m of src.matchAll(jsRe)) jsQueue.push(m[0])
	} catch (e) { jsSeen.set(u, null); console.log("js FAIL", u, String(e)) }
}
await fs.writeFile(path.join(OUT, "js/index.json"), JSON.stringify(Object.fromEntries(jsSeen), null, 1))
console.log("js modules", jsSeen.size)

// 4) Screenshots + hydrated DOM/CSS
const browser = await chromium.launch()
for (const w of req.widths) {
	const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, userAgent: UA, deviceScaleFactor: 1 })
	const page = await ctx.newPage()
	for (const p of pages) {
		try {
			await page.goto(BASE + encodeURI(p), { waitUntil: "networkidle", timeout: 90000 })
			await page.evaluate(async () => {
				const H = document.documentElement.scrollHeight
				for (let y = 0; y < H; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)) }
				window.scrollTo(0, 0)
				await new Promise((r) => setTimeout(r, 1200))
			})
			const n = nameFor(p)
			await page.screenshot({ path: path.join(OUT, "shots", `${n}-${w}.jpg`), fullPage: true, type: "jpeg", quality: 55 })
			if (req.hydrateWidths.includes(w)) {
				const dom = await page.evaluate(() => document.documentElement.outerHTML)
				await fs.writeFile(path.join(OUT, "hydrated", `${n}-${w}.html`), dom)
				const css = await page.evaluate(() => [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join("\n") } catch { return "" } }).join("\n"))
				await fs.writeFile(path.join(OUT, "hydrated", `${n}-${w}.css`), css)
			}
			console.log("shot", p, w)
		} catch (e) { console.log("shot FAIL", p, w, String(e)) }
	}
	await ctx.close()
}

// 5) Optional scripted interactions (clicks) to record open states
for (const it of req.interactions || []) {
	const ctx = await browser.newContext({ viewport: { width: it.width, height: 900 }, userAgent: UA })
	const page = await ctx.newPage()
	try {
		await page.goto(BASE + encodeURI(it.page), { waitUntil: "networkidle", timeout: 90000 })
		for (const step of it.steps) {
			if (step.click) await page.locator(step.click).first().click({ timeout: 8000 })
			if (step.hover) await page.locator(step.hover).first().hover({ timeout: 8000 })
			await page.waitForTimeout(step.wait || 900)
		}
		const html = it.capture ? await page.locator(it.capture).first().evaluate((el) => el.outerHTML) : await page.evaluate(() => document.body.outerHTML)
		await fs.writeFile(path.join(OUT, "hydrated", `interaction-${it.name}.html`), html)
		await page.screenshot({ path: path.join(OUT, "shots", `interaction-${it.name}.jpg`), type: "jpeg", quality: 60 })
		console.log("interaction", it.name)
	} catch (e) { console.log("interaction FAIL", it.name, String(e)) }
	await ctx.close()
}
await browser.close()
console.log("done")
