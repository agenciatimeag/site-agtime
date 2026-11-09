// Tira prints do site local nas 3 larguras (mesmo processo da captura do original).
// Uso: node tools/dev/shots.mjs <outDir> <page...>   (pages: / /sobre ...)
import { createRequire } from "node:module"
const { chromium } = createRequire(import.meta.url)("playwright")
import fs from "node:fs"
const [out, ...pages] = process.argv.slice(2)
const widths = (process.env.W || "1440,810,390").split(",").map(Number)
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const errors = []
for (const w of widths) {
	const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 })
	for (const p of pages) {
		const page = await ctx.newPage()
		page.on("pageerror", (e) => errors.push(p + " " + w + ": " + e.message))
		page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(p + " " + w + " console: " + m.text().slice(0, 200)) })
		page.on("requestfailed", (r) => errors.push(p + " " + w + " failed: " + r.url().slice(0, 120)))
		page.on("response", (r) => { if (r.status() >= 400) errors.push(p + " " + w + " " + r.status() + ": " + r.url().slice(0, 120)) })
		await page.goto("http://localhost:4173" + p, { waitUntil: "networkidle" })
		const h = await page.evaluate(() => document.documentElement.scrollHeight)
		for (let y = 0; y < h; y += 500) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(120) }
		await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500)
		const name = (p === "/" ? "home" : p.slice(1).replace(/[^a-z0-9]+/gi, "_"))
		await page.screenshot({ path: `${out}/${name}-${w}.jpg`, fullPage: true, quality: 70 })
		await page.close()
	}
	await ctx.close()
}
await browser.close()
fs.writeFileSync(`${out}/errors.txt`, errors.join("\n"))
console.log("errors:", errors.length); console.log(errors.slice(0, 25).join("\n"))
