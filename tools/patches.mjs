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
	const many = $(el).toArray()
	if (many.length > 1) return many.forEach((e) => setText($, e, text))
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
		const txt = $el.text().replace(/\s+/g, " ").trim()
		if (!ENGLISH.test(txt) || /[ãçõáéíóúê]/i.test(txt)) return
		if (ctx.visibleAt(el, 1440)) return
		const cls = ($el.attr("class") || "").split(/\s+/).find((c) => /^framer-[a-z0-9]+$/.test(c))
		if (!cls) return
		const twin = $("." + cls).toArray().find((o) => o !== el && ctx.visibleAt(o, 1440) && !ENGLISH.test($(o).text().replace(/\s+/g, " ")))
		if (!twin) return
		const src = [], dst = []
		$(twin).find("*").contents().each((_, x) => { if (x.type === "text" && x.data.trim()) src.push(x) })
		$el.find("*").contents().each((_, x) => { if (x.type === "text" && x.data.trim()) dst.push(x) })
		const sk = $(twin).children().toArray(), dk = $el.children().toArray()
		if (src.length === dst.length) dst.forEach((x, i) => (x.data = src[i].data))
		// mesma quantidade de parágrafos: troca só o conteúdo, mantendo alinhamento/estilo do celular
		else if (sk.length === dk.length) dk.forEach((d, i) => $(d).html($(sk[i]).html()))
		else $el.html($(twin).html())
		n++
	})
	return n
}

function fixLinks($, pagePath = "/") {
	$("a[href]").each((_, a) => {
		const $a = $(a), href = $a.attr("href")
		if (/framer\.com\/\?via|westhill/.test(href)) $a.attr("href", "/contato")
		else if (/x\.com\/MandroDesign/.test(href)) $a.removeAttr("href")
		else if (/^https?:\/\/(www\.)?instagram\.com\/?$/.test(href)) $a.attr("href", "https://www.instagram.com/agtime.oficial/")
		else if (/^https?:\/\/(www\.)?youtube\.com\/?$/.test(href)) $a.attr("href", `https://wa.me/${WHATS}`)
		else if (/^\.{1,2}(\/|$)/.test(href)) {
			// links relativos do Framer ("./contato", "../") -> caminho absoluto
			const u = new URL(href, "https://x" + pagePath)
			$a.attr("href", decodeURI(u.pathname).replace(/(.)\/$/, "$1") + u.hash)
		}
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

const COMPONENTS = JSON.parse(fs.readFileSync(path.join(ROOT, "capture/components.json"), "utf8"))
const FAQ = JSON.parse(fs.readFileSync(path.join(ROOT, "data/faq.json"), "utf8"))
const containerClass = ($el) => ($el.attr("class") || "").split(/\s+/).find((c) => /^framer-[a-z0-9]+-container$/.test(c))

function tickerMarks($) {
	// Ticker do Framer: <div class="framer-xxx-container"><section …><ul …><li>…</li></ul></section></div>
	$("section > ul").each((_, ul) => {
		const $ul = $(ul), st = $ul.attr("style") || ""
		if (!/display:\s*flex/.test(st)) return
		const props = COMPONENTS.tickers[containerClass($ul.parent().parent())] || {}
		$ul.attr("data-ticker", props.speed == null ? 100 : props.speed)
		$ul.attr("data-ticker-dir", props.direction === true ? "left" : props.direction || (/flex-direction:\s*column/.test(st) ? "top" : "left"))
		if (props.hoverFactor != null && props.hoverFactor !== 1) $ul.attr("data-ticker-hover", props.hoverFactor)
	})
}

function raysMarks($) {
	for (const [cls, props] of Object.entries(COMPONENTS.lightRays)) {
		$("." + cls).each((_, c) => {
			const host = $(c).children().first()
			if (!host.length) return
			host.empty() // remove o <canvas> do three.js copiado da captura
			const { animation, intensity, position, rays, reach, raysColor } = props
			// luz marfim com sálvia (paleta da marca), mais suave que o verde-limão do template
			const soft = { mode: "multi", color1: "#FDFFF8", color2: "#BAC18D" }
			host.attr("data-rays", JSON.stringify({ animation, intensity: Math.round((intensity == null ? 50 : intensity) * 0.8), position, rays, reach, raysColor: soft }))
		})
	}
}

// FAQ (componente framer-g8i14): insere a resposta e liga o abre/fecha
function faqMarks($) {
	const norm = (t) => t.replace(/\s+/g, " ").trim()
	const answers = Object.fromEntries(Object.entries(FAQ).map(([q, a]) => [norm(q), a]))
	$(".framer-g8i14.framer-v-1v29omc").each((_, root) => {
		const $r = $(root)
		const q = norm($r.find(".framer-1al39dj").text())
		const a = answers[q]
		if (!a) return
		const paras = a.split("\n").map((t) => t.replace(/(www\.lemify\.com\.br)/, '<a href="https://www.lemify.com.br" target="_blank" rel="noopener" style="color:inherit">$1</a>'))
		$r.append(`<div class="framer-1krqqod" data-framer-name="Answer" data-when-open style="--extracted-r6o4lv:var(--token-d2ee1de5-88f8-41d7-8642-338767096a94, rgba(255, 255, 255, 0.6));--framer-paragraph-spacing:0px;transform:none">${paras.map((t) => `<p class="framer-text framer-styles-preset-x0s9r5" style="--framer-text-color:var(--extracted-r6o4lv, var(--token-d2ee1de5-88f8-41d7-8642-338767096a94, rgba(255, 255, 255, 0.6)))">${t}</p>`).join("")}</div>`)
		$r.attr("data-vt", JSON.stringify({ scope: "framer-g8i14", from: "framer-v-1v29omc", to: "framer-v-1u3l64d", id: "XkjwhHCcs" }))
	})
}

// Menu do celular/tablet (componente framer-LDtDO): Mobile Closed <-> Mobile Open
function menuMarks($) {
	$(".framer-LDtDO.framer-v-1x71hfi").each((_, root) => {
		$(root).attr("data-vt", JSON.stringify({ scope: "framer-LDtDO", from: "framer-v-1x71hfi", to: "framer-v-csul5u", id: "A2qOxz8VD", trigger: ".framer-12regrz", closeOnLink: true, transition: { type: "spring", duration: 0.4, bounce: 0 } }))
		$(root).find(".framer-12regrz").attr("aria-label", "Abrir menu")
	})
}

const HONEYPOT = ["website", "company", "message", "subject", "title", "description", "feedback", "notes", "details", "remarks", "comments"]
export function whatsappForms($) {
	$("form").each((_, f) => {
		const $f = $(f)
		$f.find("input").filter((_, i) => HONEYPOT.includes($(i).attr("name")) && !$(i).attr("class")).each((_, i) => {
			const p = $(i).parent()
			$(i).remove()
			if (!p.children().length && !p.text().trim() && !p.is("form")) p.remove()
		})
		$f.attr({ "data-whatsapp": WHATS })
		if ($f.find('input[type="email"]').length && !$f.find("textarea").length) {
			$f.attr("data-whatsapp-intro", "Olá! Quero receber as notícias de marketing da Agência Time.")
			$f.find('input[type="email"]').attr({ name: "E-mail", required: "" })
		}
	})
}


function fixHead($, pagePath) {
	const url = "https://www.agtime.com.br" + (pagePath === "/" ? "/" : pagePath)
	$('link[rel="canonical"]').attr("href", url)
	$('meta[property="og:url"]').attr("content", url)
	$('meta[name^="framer-search-index"]').remove()
	$('meta[property="og:image"], meta[name="twitter:image"]').each((_, m) => {
		const c = $(m).attr("content") || ""
		if (/framerusercontent/.test(c)) $(m).attr("data-abs-asset", "1")
	})
}

const FAQ_TEXT = "Tem dúvidas? Nossa seção de perguntas frequentes (FAQ) tem respostas rápidas para as dúvidas mais comuns."
function words($, el, text) {
	const span = $(el).find("span[style*='opacity:0.001']").first()
	if (!span.length) return setText($, el, text)
	const st = span.attr("style")
	$(el).html(text.split(/\s+/).map((w) => `<span style="${st}">${w}</span>`).join(" "))
}
// FAQ do modelo (páginas de projeto) ainda em inglês
function faqTexts($) {
	$("h2, h3").each((_, el) => {
		const t = $(el).text().replace(/\s+/g, " ").trim()
		if (t === "Frequently") words($, el, "Perguntas")
		else if (t === "Asked Questions") words($, el, "Frequentes")
	})
	$("p").filter((_, el) => /^Have questions\? Our FAQ section/.test($(el).text().trim())).each((_, el) => $(el).html(FAQ_TEXT))
}
// frase solta do template que sobrou em algumas versões de celular
function leftoverEnglish($) {
	$("p").filter((_, el) => /^Effortlessly connect with your favorite tools/.test($(el).text().replace(/\s+/g, " ").trim())).each((_, el) => {
		const inFaq = $(el).closest("section, [data-framer-name=FAQ]").find(".framer-g8i14").length
		$(el).html(inFaq ? FAQ_TEXT : "Estratégia, criatividade e tecnologia trabalhando juntas pelo crescimento da sua marca.")
	})
}

// palavras soltas (texto animado palavra por palavra) com erro de digitação
function wordFixes($) {
	$("span").each((_, sp) => { const t = $(sp).text(); if (t === "Degin") $(sp).text("Design") })
}

export function patchCommon(ctx) {
	const { $ } = ctx
	replaceTexts($)
	wordFixes($)
	faqTexts($)
	fixResponsiveEnglish(ctx)
	leftoverEnglish($)
	fixLinks($, ctx.path)
	fixHead($, ctx.path)
	whatsappForms($)
	revealTextMarks($)
	tickerMarks($)
	raysMarks($)
	faqMarks($)
	menuMarks($)
	$("html").attr("lang", "pt-BR")
}

export async function loadPagePatches() {}

export function patchPage(ctx) {
	const mod = PAGE_PATCHES[ctx.id]
	if (mod) mod(ctx)
}

const PAGE_PATCHES = {}
export function registerPage(id, fn) { PAGE_PATCHES[id] = fn }
export const consts = { WHATS, MAPS, ROOT, COMPONENTS }
