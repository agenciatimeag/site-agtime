// Shared helpers for turning Framer's server-rendered HTML into a standalone static page.
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
export const assets = JSON.parse(fs.readFileSync(path.join(ROOT, "capture/assets.json"), "utf8"))

const decode = (u) => u.replace(/&amp;/g, "&")
// framerusercontent.com/images/<id>.<ext>?... -> local file (exact variant if captured, else original)
export function localAsset(url) {
	const u = decode(url)
	if (assets[u]) return assets[u]
	const bare = u.split("?")[0]
	if (assets[bare]) return assets[bare]
	for (const k of Object.keys(assets)) if (k.split("?")[0] === bare) return assets[k]
	return null
}

const assetRe = /https:\/\/(?:framerusercontent\.com\/(?:images|assets|third-party-assets)\/[^"'\s)<>\\,]+|fonts\.gstatic\.com\/[^"'\s)<>\\]+)/g
export function rewriteAssetUrls(text, missing) {
	return text.replace(assetRe, (m) => {
		const l = localAsset(m)
		if (!l) { missing?.add(m); return m }
		return l
	})
}

// Remove Framer runtime, analytics, badge and hydration data.
export function stripFramerRuntime($) {
	$("script").each((_, el) => {
		const s = $(el)
		const id = s.attr("id") || ""
		const type = s.attr("type") || ""
		if (id === "__framer__appearAnimationsContent" || id === "__framer__breakpoints") return // keep, read by our runtime
		if (type === "application/ld+json" && !/framer/i.test(s.html() || "")) return // dados estruturados do site
		s.remove()
	})
	$('link[rel="modulepreload"], link[rel="preload"][as="script"], link[href*="framerusercontent.com/sites"], link[rel="preconnect"]').remove()
	$("#__framer-badge-container, [data-framer-badge]").remove()
	$('meta[name="generator"]').remove()
	$("[data-framer-hydrate-v2]").removeAttr("data-framer-hydrate-v2")
}
