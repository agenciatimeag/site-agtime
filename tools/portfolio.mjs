// Portfólio: cards de projeto (home e /portfolio), seções novas (Mais projetos, Artes)
// e as páginas de cada projeto (/portfolio/<slug>), geradas a partir do modelo de detalhe do Framer.
import fs from "node:fs"
import path from "node:path"
import { registerPage, setText, consts } from "./patches.mjs"

const DATA = JSON.parse(fs.readFileSync(path.join(consts.ROOT, "data/portfolio.json"), "utf8"))
export const PROJECTS = DATA.projects
import { localAsset } from "./lib/html.mjs"
// largura/altura da imagem (lê o cabeçalho do arquivo PNG/JPEG já capturado)
function imgSize(url) {
	const l = localAsset(url)
	if (!l) return null
	const b = fs.readFileSync(path.join(consts.ROOT, "public", l))
	if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
	let i = 2
	while (i < b.length) {
		if (b[i] !== 0xff) return null
		const m = b[i + 1], len = b.readUInt16BE(i + 2)
		if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
		i += 2 + len
	}
	return null
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const bare = (u) => u.split("?")[0]

// Texto com efeito "palavra por palavra" do Framer: refaz os <span> de cada palavra.
export function setWords($, el, text) {
	const $el = $(el)
	const span = $el.find("span[style*='opacity:0.001']").first()
	if (!span.length) return setText($, el, text)
	const st = span.attr("style")
	$el.html(String(text).split(/\s+/).filter(Boolean).map((w) => `<span style="${st}">${esc(w)}</span>`).join(" "))
}

function setImg($, img, url, alt) {
	const $i = $(img)
	if (!$i.length) return
	$i.attr("src", bare(url))
	$i.removeAttr("srcset")
	if (alt != null) $i.attr("alt", alt)
}

// Card "Work Card Primary" (home e /portfolio). `wrap` contém o <a> e as variantes por breakpoint.
export function fillWorkCard($, wrap, p) {
	const $w = $(wrap)
	$w.find("a").addBack("a").first().attr("href", `/portfolio/${p.slug}`)
	$w.find(".framer-VMRCM").each((_, card) => {
		const $c = $(card)
		setText($, $c.find(".framer-gek87r p").first(), p.year)
		setText($, $c.find(".framer-9xm2m6 h4, .framer-9xm2m6 p").first(), p.title)
		$c.find(".framer-8dtvqw .framer-mdgjf0 p").each((i, el) => setText($, el, p.points[i] || ""))
		$c.find(".framer-zxhf1f .framer-1pw8fxn p").each((i, el) => setText($, el, p.tags[i] || ""))
		setImg($, $c.find(".framer-1206r8s img").first(), p.img1.url, p.img1.alt)
		setImg($, $c.find(".framer-vk9m4r img").first(), p.img2.url, p.img2.alt)
	})
}

// Card "Work Card Secondary" (outros trabalhos, na página do projeto)
function fillSecondaryCard($, wrap, p) {
	const $w = $(wrap)
	$w.find("a").addBack("a").first().attr("href", `/portfolio/${p.slug}`)
	setText($, $w.find(".framer-1p919nn h4"), p.title)
	$w.find(".framer-1c58yda p").each((_, el) => setText($, el, p.year))
	$w.find(".framer-pd56mf img").each((_, img) => setImg($, img, p.img1.url, p.img1.alt))
	$w.find(".framer-19v8eng-container .framer-1pw8fxn p").each((_, el) => setText($, el, p.category))
}

/* ---------------- home: 3 primeiros projetos ---------------- */
export function homePortfolio(ctx) {
	const { $ } = ctx
	// cada card fica num container com efeito de entrada, dentro de um link
	const conts = ["framer-1uufdj1-container", "framer-dz2cqt-container", "framer-1b1npw3-container"]
	conts.forEach((c, i) => {
		const links = new Set($("." + c).map((_, el) => $(el).closest("a")[0] || el).get())
		links.forEach((el) => fillWorkCard($, el, PROJECTS[i]))
	})
}

/* ---------------- /portfolio ---------------- */
const smallCard = (p) => `<a class="tm-pcard" href="/portfolio/${p.slug}" data-framer-cursor="8bnwio">
	<div class="tm-pcard-img"><img src="${esc(bare(p.img1.url))}" alt="${esc(p.img1.alt)}" loading="lazy" decoding="async"></div>
	<div class="tm-pcard-info"><p class="tm-pcard-title">${esc(p.title)}</p><p class="tm-meta">${esc(p.category)}<span>·</span>${esc(p.year)}</p></div>
</a>`
const artCard = (a) => {
	const d = imgSize(a.img)
	return `<figure class="tm-art">
	<a href="${esc(bare(a.img))}" data-lightbox="${esc(bare(a.img))}" aria-label="Ampliar ${esc(a.title)}"><img src="${esc(bare(a.img))}" alt="${esc(a.title + " · " + a.client)}"${d ? ` width="${d.w}" height="${d.h}" data-ratio="${(d.h / d.w).toFixed(3)}"` : ""} loading="lazy" decoding="async"></a>
	<figcaption><b>${esc(a.title)}</b><span>·</span>${esc(a.client)}</figcaption>
</figure>`
}
const videoCard = (v) => {
	const id = (v.youtube.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || [])[1]
	if (!id) return ""
	return `<figure class="tm-video"><div class="tm-video-frame" data-yt="${id}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><button aria-label="Assistir ${esc(v.title)}"></button></div><figcaption><b>${esc(v.title)}</b><span>·</span>${esc(v.client)}</figcaption></figure>`
}

export function portfolioPage(ctx) {
	const { $ } = ctx
	const bottom = $(".framer-1s8q2e8").first() // lista de cards do modelo
	const wraps = bottom.children().toArray()
	const tpl = $.html(wraps[0])
	// 6 cards grandes
	bottom.empty()
	PROJECTS.slice(0, 6).forEach((p) => {
		const $w = $(tpl)
		fillWorkCard($, $w, p)
		bottom.append($w)
	})
	bottom.attr("id", "projetos").addClass("tm-anchor")
	const videos = DATA.videos || []
	const tabs = `<nav class="tm-tabs" aria-label="Seções do portfólio"><a href="#projetos">Projetos</a><a href="#artes">Artes</a>${videos.length ? '<a href="#videos">Vídeos</a>' : ""}</nav>`
	// abas logo abaixo do botão do topo
	$(".framer-2xwmk5").first().after(tabs)
	bottom.before(`<div class="tm-head"><h3 class="tm-h3">Projetos</h3><p class="tm-p">Cases completos, do planejamento à entrega.</p></div>`)
	const more = PROJECTS.slice(6)
	let extra = `<div class="tm-section tm-more"><h4 class="tm-h4">Mais projetos</h4><div class="tm-grid">${more.map(smallCard).join("")}</div></div>`
	extra += `<div class="tm-section tm-anchor" id="artes"><div class="tm-head"><h3 class="tm-h3">Artes</h3><p class="tm-p">Posts, campanhas, identidades visuais e peças gráficas criadas para nossos clientes.</p></div><div class="tm-masonry" data-masonry>${DATA.arts.map(artCard).join("")}</div></div>`
	if (videos.length) extra += `<div class="tm-section tm-anchor" id="videos"><div class="tm-head"><h3 class="tm-h3">Vídeos</h3><p class="tm-p">Institucionais, campanhas, reels e conteúdos em vídeo produzidos pela Time.</p></div><div class="tm-grid tm-grid-2">${videos.map(videoCard).join("")}</div></div>`
	bottom.after(extra)
}

/* ---------------- /portfolio/<slug> ---------------- */
function detailPage(ctx, p) {
	const { $ } = ctx
	const others = PROJECTS.filter((x) => x.slug !== p.slug).slice(0, 2)
	// topo
	$(".framer-12lke1p p").each((_, el) => setText($, el, p.tagHighlight))
	$(".framer-1ruvc2z-container .framer-1pw8fxn p").each((_, el) => setText($, el, p.date))
	$(".framer-11mqcdl h1").each((_, el) => setWords($, el, p.innerTitle))
	$(".framer-1d26g0z p").each((_, el) => setWords($, el, p.description))
	$(".framer-1pr47zm-container .framer-1pw8fxn p").each((_, el) => setText($, el, p.tags[0]))
	$(".framer-1u72gl4-container .framer-1pw8fxn p").each((_, el) => setText($, el, p.tags[1]))
	// cartão lateral
	const pairs = [[".framer-bz9tpf", "Serviço"], [".framer-1hqjdkt", p.service], [".framer-1wgmzke", "Categoria"], [".framer-1u9tesb", p.category2], [".framer-949c1c", "Cliente"], [".framer-1y8le9b", p.client]]
	for (const [sel, t] of pairs) $(sel).each((_, el) => setText($, $(el).find("p, h1, h2, h3, h4, h5, h6").first().length ? $(el).find("p, h1, h2, h3, h4, h5, h6").first() : el, t))
	$(".framer-1r66dj7-container").closest(".ssr-variant").remove()
	$(".framer-1r66dj7-container").remove()
	// conteúdo do modelo (em inglês) sai; entra a galeria com as duas imagens do projeto
	const details = $(".framer-1wzvdqa")
	;[".framer-ktt5yz", ".framer-77g8gs", ".framer-19cjylp", ".framer-1wdb5r9", ".framer-1v4i7cf", ".framer-1af3ww0"].forEach((s) => $(s).remove())
	const gimg = (im) => `<a class="tm-gallery-item" href="${esc(bare(im.url))}" data-lightbox="${esc(bare(im.url))}"><img src="${esc(bare(im.url))}" alt="${esc(im.alt)}" decoding="async"></a>`
	details.after(`<div class="tm-gallery" data-reveal>${gimg(p.img2)}${gimg(p.img1)}</div>`)
	// outros trabalhos
	$(".framer-1uw3jty h2").each((_, el) => setWords($, el, "Outros trabalhos"))
	$(".framer-1j3edhd-container").each((_, el) => { setText($, $(el).find(".framer-16xb1fn p").first(), "Ver todos os trabalhos"); $(el).find("a").attr("href", "/portfolio") })
	const cards = $(".framer-c954yj a").toArray()
	cards.forEach((c, i) => { if (others[i]) fillSecondaryCard($, c, others[i]); else $(c).remove() })
	// links do modelo que apontavam para a própria página
	$('a[href^="/portfolio/million-one"]').each((_, a) => $(a).attr("href", $(a).attr("href").replace("/portfolio/million-one", `/portfolio/${p.slug}`)))
	// FAQ do modelo de detalhe ainda estava em inglês
	$("h2").each((_, el) => {
		const t = $(el).text().replace(/\s+/g, " ").trim()
		if (t === "Frequently") setWords($, el, "Perguntas")
		else if (t === "Asked Questions") setWords($, el, "Frequentes")
	})
	$("p").filter((_, el) => /^Have questions\? Our FAQ section/.test($(el).text().trim())).each((_, el) => $(el).html("Tem dúvidas? Nossa seção de perguntas frequentes (FAQ) tem respostas rápidas para as dúvidas mais comuns."))
	// metadados
	$("title").text(`${p.innerTitle} | Agência Time`)
	$('meta[property="og:title"], meta[name="twitter:title"]').attr("content", `${p.innerTitle} | Agência Time`)
	$('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').attr("content", p.description)
}

export function buildPortfolioDetails(buildPage) {
	return PROJECTS.map((p) => {
		const r = buildPage("portfolio_million-one", (ctx) => detailPage(ctx, p), `/portfolio/${p.slug}`)
		return { out: `portfolio/${p.slug}/index.html`, ...r }
	})
}
