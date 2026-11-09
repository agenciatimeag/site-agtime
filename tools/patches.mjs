// Alterações de conteúdo aplicadas sobre a captura do site (textos em português, links, seções novas).
import fs from "node:fs"
import path from "node:path"
import { mqMatches } from "./lib/fill.mjs"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const WHATS = "5527998704892"
const MAPS = "https://www.google.com/maps/place/?q=place_id:ChIJpR-mDtFXuAARogTaLDD-3ws"

// texto antigo (exato, após trim) -> texto novo
const EXACT = {
	"Ctiação de conteúdo": "Criação de conteúdo",
	"Problem Solved": "Problema resolvido!",
	"Hey, It’s me!": "Oi, tô por aqui!",
	"Hey, It's me!": "Oi, tô por aqui!",
	"AI Design": "Estratégia",
	"Tech Innovation": "Inovação",
	"Easy Customization": "Identidade visual",
	"Brand Identity": "Campanhas",
	"Book an Appointment": "Agendar uma conversa",
	"View About Reboot": "Conheça a Time",
	"Cognitive": "Branding",
	"Intelligent": "Social Media",
	"Infrastructure": "Tráfego pago",
	"Chatbots": "Audiovisual",
	"Data Analysis": "Identidade visual",
	"Speech Recognition": "Tudo em tempo real",
	"About": "Sobre nós",
	"Contact": "Contato",
	"View Now": "Ver agora",
	"Open LinkedIn": "Abrir LinkedIn",
	"Explore Our Journey": "Nossa história",
	"About Nubien": "Sobre a Time",
	"900+ People Rated": "+100 clientes atendidos",
	"Primeiro Nome*": "Nome*",
	"Último nome*": "Sobrenome*",
	"404 - Oops Page": "404",
}
const SUB = [["landig pages", "landing pages"], ["Cliente, Degin e Resultado", "Cliente, Design e Resultado"]]

export function replaceTexts($, root, map = EXACT, subs = SUB) {
	let n = 0
	$(root || "body").find("*").addBack().contents().each((_, node) => {
		if (node.type !== "text") return
		const t = node.data.trim()
		if (!t) return
		if (Object.prototype.hasOwnProperty.call(map, t)) { node.data = node.data.replace(t, map[t]); n++; return }
		for (const [a, b] of subs) if (node.data.includes(a)) { node.data = node.data.split(a).join(b); n++ }
	})
	return n
}

export const setText = ($, el, text) => {
	// troca só o texto, mantendo a estrutura <p><span>…</span></p>
	const nodes = []
	$(el).find("*").addBack().contents().each((_, n) => { if (n.type === "text" && n.data.trim()) nodes.push(n) })
	if (!nodes.length) { $(el).text(text); return }
	nodes[0].data = text
	for (let i = 1; i < nodes.length; i++) nodes[i].data = ""
}

const ENGLISH = /\b(the|your|our|with|and|you|we|is|are|Oops|Effortlessly|Seamless|Empowering|Services|Clients|Questions|Check Out|Design is Great|Each Project|Harnessing|AI-Powered|What Our)\b/

// Textos de celular/tablet que ficaram em inglês: copia o texto da versão de desktop do mesmo elemento.
function fixResponsiveEnglish(ctx) {
	const { $ } = ctx
	let n = 0
	$("[class*=framer-]").each((_, el) => {
		const $el = $(el)
		if (!$el.children("p, h1, h2, h3, h4, h5, h6").length) return
		const txt = $el.text().trim()
		if (!ENGLISH.test(txt) || /[ãçõáéíóúê]/i.test(txt)) return
		if (ctx.visibleAt(el, 1440)) return
		const cls = ($el.attr("class") || "").split(/\s+/).find((c) => /^framer-[a-z0-9]+$/.test(c))
		if (!cls) return
		const twin = $("." + cls).toArray().find((o) => o !== el && ctx.visibleAt(o, 1440) && !ENGLISH.test($(o).text()))
		if (!twin) return
		const src = [], dst = []
		$(twin).find("*").contents().each((_, x) => { if (x.type === "text" && x.data.trim()) src.push(x) })
		$el.find("*").contents().each((_, x) => { if (x.type === "text" && x.data.trim()) dst.push(x) })
		if (src.length === dst.length) dst.forEach((x, i) => (x.data = src[i].data))
		else $el.html($(twin).html())
		n++
	})
	return n
}

function fixLinks($) {
	$("a[href]").each((_, a) => {
		const $a = $(a), href = $a.attr("href")
		if (/framer\.com\/\?via|westhill/.test(href)) $a.attr("href", "/contato")
		else if (/x\.com\/MandroDesign/.test(href)) $a.removeAttr("href")
		else if (/^https?:\/\/(www\.)?instagram\.com\/?$/.test(href)) $a.attr("href", "https://www.instagram.com/agtime.oficial/")
		else if (/^https?:\/\/(www\.)?youtube\.com\/?$/.test(href)) $a.attr("href", `https://wa.me/${WHATS}`)
		else if (/^\.\//.test(href)) $a.attr("href", href.replace(/^\.\//, "/").replace(/^\/$/, "/"))
		else if (href === ".") $a.attr("href", "/")
	})
	// rodapé: item "Youtube" (link de afiliado do template) fica escondido
	$("a").filter((_, a) => $(a).text().trim() === "Youtube").each((_, a) => { $(a).closest("[class*=-container]").css("display", "none") })
}

function revealTextMarks($) {
	$("[class*=framer-] > p").each((_, p) => {
		const $p = $(p)
		const st = $p.attr("style") || ""
		if (/color:#666666/.test(st) && /flex-wrap:wrap/.test(st)) $p.attr("data-reveal-text", "40")
	})
}

function tickerMarks($) {
	// Ticker do Framer: <section …><ul …><li>…</li></ul></section>
	$("section > ul").each((_, ul) => {
		const $ul = $(ul), st = $ul.attr("style") || ""
		if (!/display:\s*flex/.test(st)) return
		const sp = ($ul.closest("[data-ticker-speed]").attr("data-ticker-speed")) || 40
		$ul.attr("data-ticker", sp)
		if (/flex-direction:\s*column/.test(st)) $ul.attr("data-ticker-dir", "y")
	})
}

export function patchCommon(ctx) {
	const { $ } = ctx
	replaceTexts($)
	fixResponsiveEnglish(ctx)
	fixLinks($)
	revealTextMarks($)
	tickerMarks($)
	$("html").attr("lang", "pt-BR")
}

export async function loadPagePatches() {}

export function patchPage(ctx) {
	const mod = PAGE_PATCHES[ctx.id]
	if (mod) mod(ctx)
}

const PAGE_PATCHES = {}
export function registerPage(id, fn) { PAGE_PATCHES[id] = fn }
export const consts = { WHATS, MAPS, ROOT }
