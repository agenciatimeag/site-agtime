// Servidor estático simples para testar a pasta public/ (cleanUrls como na Vercel).
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
const ROOT = path.resolve(process.argv[2] || "public")
const PORT = +(process.argv[3] || 4173)
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ico": "image/x-icon" }
http.createServer((req, res) => {
	let p = decodeURIComponent(new URL(req.url, "http://x").pathname)
	const cands = [p, p + ".html", path.join(p, "index.html")]
	for (const c of cands) {
		const f = path.join(ROOT, c)
		if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) {
			res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" })
			return fs.createReadStream(f).pipe(res)
		}
	}
	res.writeHead(404, { "content-type": "text/html; charset=utf-8" })
	fs.createReadStream(path.join(ROOT, "404.html")).pipe(res)
}).listen(PORT, () => console.log("http://localhost:" + PORT))
