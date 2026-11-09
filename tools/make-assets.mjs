// Gera arquivos próprios do site: ícones dos canais do Lemify, favicon e imagem de compartilhamento.
// Uso: node tools/make-assets.mjs
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import sharp from "sharp"
import * as si from "simple-icons"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const OUT = path.join(ROOT, "public/_assets/custom")
fs.mkdirSync(OUT, { recursive: true })

/* ---------- ícones dos canais (mesmo formato dos ícones do template: círculo 44px com brilho) ---------- */
const shade = (hex, f) => {
	const n = parseInt(hex, 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))))
	return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("")
}
function badge(name, bg, glyph, glyphColor = "#fff") {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44" fill="none">
<defs><linearGradient id="g" x1="22" y1="0" x2="22" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="${shade(bg, 0.18)}"/><stop offset="1" stop-color="${shade(bg, -0.22)}"/></linearGradient>
<radialGradient id="h" cx="0" cy="0" r="1" gradientTransform="matrix(0 22 -22 0 22 4)" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="44" height="44" rx="22" fill="url(#g)"/><rect width="44" height="44" rx="22" fill="url(#h)"/>
<rect x=".5" y=".5" width="43" height="43" rx="21.5" stroke="#fff" stroke-opacity=".18"/>
<g transform="translate(12 12) scale(.8333)" fill="${glyphColor}"><path d="${glyph}"/></g>
<title>${name}</title></svg>`
}
const CHANNELS = [
	["whatsapp", "WhatsApp", si.siWhatsapp],
	["instagram", "Instagram", si.siInstagram],
	["messenger", "Messenger", si.siMessenger],
	["facebook", "Facebook", si.siFacebook],
	["telegram", "Telegram", si.siTelegram],
	["gmail", "E-mail", si.siGmail],
	["googlemaps", "Google", si.siGooglemaps],
	["tiktok", "TikTok", { hex: "1A1A1A", path: si.siTiktok.path }],
]
for (const [file, name, icon] of CHANNELS) fs.writeFileSync(path.join(OUT, `ch-${file}.svg`), badge(name, icon.hex, icon.path))
// chat do site (balão de conversa)
const CHAT = "M12 2C6.48 2 2 5.94 2 10.8c0 2.76 1.45 5.22 3.72 6.83L5 22l4.53-2.47c.79.17 1.62.27 2.47.27 5.52 0 10-3.94 10-8.8S17.52 2 12 2Zm-4.5 10.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"
fs.writeFileSync(path.join(OUT, "ch-chat.svg"), badge("Chat do site", "6D5BD0", CHAT))
// centro: atendimento com IA (brilho), nas cores da Time
const SPARK = "M12 1.5c.5 0 .9.33 1.03.8l1.3 4.6a3.5 3.5 0 0 0 2.4 2.4l4.6 1.3a1.07 1.07 0 0 1 0 2.06l-4.6 1.3a3.5 3.5 0 0 0-2.4 2.4l-1.3 4.6a1.07 1.07 0 0 1-2.06 0l-1.3-4.6a3.5 3.5 0 0 0-2.4-2.4l-4.6-1.3a1.07 1.07 0 0 1 0-2.06l4.6-1.3a3.5 3.5 0 0 0 2.4-2.4l1.3-4.6A1.07 1.07 0 0 1 12 1.5Z"
fs.writeFileSync(path.join(OUT, "ch-ia.svg"), badge("Atendimento com IA", "DDFF93", SPARK, "#222B28"))

/* ---------- favicon: símbolo oficial (#DDFF93) sobre o verde profundo da marca (#222B28) ---------- */
const symbol = fs.readFileSync(path.join(ROOT, "brand/7430d731-SIMBOLO_ORIGINAL.svg"))
const symPng = await sharp(symbol, { density: 600 }).resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
const bgSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><radialGradient id="r" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#2c3733"/><stop offset="1" stop-color="#1a211f"/></radialGradient></defs><rect width="512" height="512" rx="112" fill="url(#r)"/></svg>`)
const icon512 = await sharp(bgSvg).composite([{ input: symPng, left: 106, top: 106 }]).png().toBuffer()
fs.writeFileSync(path.join(OUT, "icon-512.png"), icon512)
for (const sz of [32, 180, 192]) await sharp(icon512).resize(sz, sz).png().toFile(path.join(OUT, `icon-${sz}.png`))

/* ---------- imagem de compartilhamento 1200x630 (WhatsApp, LinkedIn etc.) ---------- */
const req = createRequire(import.meta.url)
const { chromium } = req("playwright")
const font = (f) => "file://" + path.join(ROOT, "public/_assets/fonts", f)
const img = (f) => "file://" + path.join(ROOT, "public/_assets/images", f)
const pick = (prefix) => fs.readdirSync(path.join(ROOT, "public/_assets/images")).find((f) => f.startsWith(prefix))
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:D;src:url(${font("rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2")});font-weight:100 1000}
@font-face{font-family:D;src:url(${font("rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6h.woff2")});font-weight:100 1000;unicode-range:U+0100-02BA,U+1E00-1EFF}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:#0d1210;font-family:D,sans-serif;color:#fdfff8;overflow:hidden;position:relative}
.glow{position:absolute;left:-330px;top:-280px;width:900px;height:760px;background:radial-gradient(closest-side,rgba(186,193,141,.22),rgba(186,193,141,0));}
.left{position:absolute;left:72px;top:70px;width:560px}
.logo{height:56px}
h1{font-weight:500;font-size:58px;line-height:1.06;letter-spacing:-2px;margin-top:64px}
h1 b{font-weight:500;color:#ddff93}
p{margin-top:26px;font-size:22px;line-height:1.45;color:rgba(253,255,248,.66)}
.tags{position:absolute;left:72px;bottom:62px;display:flex;gap:10px}
.tags span{padding:9px 16px;border-radius:999px;border:1px solid rgba(186,193,141,.25);background:rgba(253,255,248,.04);font-size:17px;color:#bac18d}
.grid{position:absolute;right:-30px;top:-40px;width:560px;height:720px;display:grid;grid-template-columns:1fr 1fr;gap:16px;transform:rotate(6deg)}
.grid div{border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,.12)}
.grid img{width:100%;height:100%;object-fit:cover;display:block}
.fade{position:absolute;left:560px;top:0;width:220px;height:630px;background:linear-gradient(90deg,#0d1210 15%,rgba(13,18,16,0))}
</style></head><body><div class="glow"></div>
<div class="grid">
<div><img src="${img(pick("tD84WiYcwh6f25dCt5UtJrLkTo"))}"></div><div><img src="${img(pick("fMZ050rQrQAkThBqSONumIQTsk"))}"></div>
<div><img src="${img(pick("D2trK6TwZe9nUhFXbfj3n6yUkg"))}"></div><div><img src="${img(pick("85qbXilGmCLHxV8XUmZRtSPKmQo"))}"></div>
<div><img src="${img(pick("VRqhpjdkHBzoiJ0g7wEGQo6jE58"))}"></div><div><img src="${img(pick("fCbWTwZ3LLlEjt3ocPcOOmmBsus"))}"></div>
</div><div class="fade"></div>
<div class="left"><img class="logo" src="file://${path.join(ROOT, "brand/555ff5b7-LOGO_COLORIDA.svg")}">
<h1>Criando com <b>propósito</b> e inteligência criativa.</h1>
<p>Agência de marketing em Guarapari (ES): estratégia, criação e performance para marcas que querem crescer.</p></div>
<div class="tags"><span>Branding</span><span>Social Media</span><span>Tráfego pago</span><span>Audiovisual</span></div>
</body></html>`
const tmp = path.join(ROOT, "tools/.og.html")
fs.writeFileSync(tmp, html)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto("file://" + tmp)
await page.waitForTimeout(800)
const png = await page.screenshot({ type: "png" })
await browser.close()
fs.unlinkSync(tmp)
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(OUT, "og-agencia-time.jpg"))
console.log("ok", fs.readdirSync(OUT).join(" "))
