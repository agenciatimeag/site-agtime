// Correções da revisão do site (links, textos, imagens do template, rodapé, SEO).
// Aplicadas em todas as páginas, depois dos ajustes de cada página.
import { setText, consts } from "./patches.mjs"

const { WHATS } = consts
const WA_TEXT = encodeURIComponent("Olá! Vim pelo site da Agência Time e quero conversar sobre a minha marca.")
const WA_URL = `https://wa.me/${WHATS}?text=${WA_TEXT}`
const MAPS = "https://www.google.com/maps/place/?q=place_id:ChIJpR-mDtFXuAARogTaLDD-3ws"
const IMG = (id) => `https://framerusercontent.com/images/${id}`

const exactText = ($, from, to) => {
	$("p, h1, h2, h3, h4, h5, h6, span").each((_, el) => {
		if ($(el).children().length) return
		if ($(el).text().trim() === from) $(el).text(to)
	})
}
const linkByText = ($, text) => $("a").filter((_, a) => $(a).text().replace(/\s+/g, " ").trim() === text)

/* ---------- 1. links e botões ---------- */
const NAV = { "Home": "/", "Sobre nós": "/sobre", "Portfolio": "/portfolio", "Portfólio": "/portfolio", "Contato": "/contato" }
function links($, ctx) {
	// itens do menu sem destino (ex.: "Sobre nós" no topo)
	$("a.framer-GPjkJ").each((_, a) => {
		const $a = $(a)
		if ($a.attr("href")) return
		const t = $a.text().trim()
		if (NAV[t]) $a.attr("href", NAV[t])
		else $a.removeAttr("target") // © no rodapé: não é link
	})
	linkByText($, "Ler mais").attr("href", "/sobre")
	linkByText($, "Quero agendar uma reunião").attr("href", "/contato")
	linkByText($, "Conhecer Lemify").attr({ href: "https://www.lemify.com.br", target: "_blank", rel: "noopener" })
	for (const t of ["Receber Ligação", "agendar ligação"]) linkByText($, t).each((_, a) => {
		$(a).attr({ href: WA_URL, target: "_blank", rel: "noopener" })
		setText($, $(a).find("p").first(), "Falar no WhatsApp")
	})
	// páginas do próprio site não abrem em nova aba
	$('a[href^="/"][target="_blank"]').removeAttr("target")
	// menu do celular/tablet: incluir FAQ (como no computador)
	const faqHref = $("a.framer-GPjkJ").filter((_, a) => $(a).text().trim() === "FAQ").first().attr("href") || "/#faq"
	$(".framer-26qar7").each((_, list) => {
		const $l = $(list)
		if ($l.find("a").filter((_, a) => $(a).text().trim() === "FAQ").length) return
		const last = $l.children().last()
		const clone = last.clone()
		clone.find("a").attr("href", faqHref)
		setText($, clone.find("p").first(), "FAQ")
		last.after(clone)
	})
}

/* ---------- 2. textos ---------- */
function texts($, ctx) {
	exactText($, "Capabilities", "Sites e IA")
	exactText($, "Portfolio", "Portfólio")
	exactText($, "Whatsapp", "WhatsApp")
	exactText($, "Seu Whatsapp*", "Seu WhatsApp*")
	exactText($, "ag.time", "Agência Time")
	exactText($, "ag time", "Agência Time")
	exactText($, "5/5 satisfação", "Nota 5,0 no Google")
	linkByText($, "Fale com especialista").each((_, a) => setText($, $(a).find("p").first(), "Fale com um especialista"))
	// Método: as iniciais seguem a ordem Cliente, Design, Resultado
	$("span").each((_, s) => { if ($(s).text() === "CRD") $(s).text("CDR") })
	$("p, h2, h3").each((_, el) => { if (!$(el).children().length && /Método CRD/.test($(el).text())) $(el).text($(el).text().replace("CRD", "CDR")) })
	if (ctx.id === "404") {
		exactText($, "OOPS", "Ops!")
		exactText($, "Page Not Found", "Erro 404")
	}
	if (ctx.id === "sobre") {
		// etiqueta "2025 · Nossa história" -> tempo de mercado
		$("p").filter((_, p) => $(p).text().trim() === "Nossa história").each((_, p) => {
			const tag = $(p).closest("[class*=-container]")
			tag.find("p").filter((_, q) => $(q).text().trim() === "2025").text("+11 anos")
		})
	}
	if (ctx.id === "contato") {
		// título próprio (antes repetia o da página inicial)
		const h = $("h1").filter((_, h) => /Criando com/.test($(h).text()))
		h.each((_, el) => $(el).html('Vamos conversar sobre'))
		$("h1").filter((_, h) => /inteligência/.test($(h).text()) && /criativa/.test($(h).text())).each((_, el) => $(el).html('o <strong class="framer-text">futuro</strong> da sua marca!'))
	}
}

/* ---------- 3. imagens e elementos do template ---------- */
const swapImg = ($, idPrefix, url, alt) => {
	$("img").filter((_, i) => ($(i).attr("src") || "").includes(idPrefix)).each((_, i) => {
		$(i).attr({ src: url, alt }).removeAttr("srcset")
	})
}
const CHANNEL_ICONS = [
	["eI9yKV9nd0AT4YF5dO7pyE64", "ch-whatsapp", "WhatsApp"],
	["sYsF5Bl4M7g4beavWohrfIF6ZE", "ch-instagram", "Instagram"],
	["23ltFY53sGksUI79i6KDahMEjsU", "ch-messenger", "Messenger"],
	["L9HqxZhZ5iQe39qHdIj1EjwUgA8", "ch-facebook", "Facebook"],
	["F9cveGfkmDYJPsUktCLECV43s4", "ch-chat", "Chat do site"],
	["KCr8sxIBnJCzZI7ThcrRzxZ8UVs", "ch-telegram", "Telegram"],
	["gqv3tuTwxsISYOQe0Zwi95OP714", "ch-gmail", "E-mail"],
	["xtU2n341VGGcU87PrpBxCo4PEFo", "ch-googlemaps", "Google"],
	["e1zEk4xxTPo4zzl3Y6DhP5avQA", "ch-tiktok", "TikTok"],
	["i3lRpYZPF6l5tginmGCGm4k6Fo", "ch-ia", "Atendimento com IA do Lemify"],
]
function images($, ctx) {
	// logo oficial (arquivo vetorial da marca) no menu e no rodapé
	$("img").filter((_, i) => ($(i).attr("src") || "").includes("vwn10rFvhHcBPIYlo4muLiaACo")).each((_, i) => {
		$(i).attr({ src: "/_assets/custom/logo-time.svg", alt: "Agência Time" }).removeAttr("srcset").removeAttr("sizes")
	})
	// Lemify: canais de atendimento no lugar dos ícones do template (Zoom, Slack, GitHub…)
	for (const [id, file, alt] of CHANNEL_ICONS) swapImg($, id, `/_assets/custom/${file}.svg`, alt)
	// foto do farol de carro (template) no carrossel do topo
	swapImg($, "y6nsXyFCXVHybL6AG2drPt8Xug", IMG("fCbWTwZ3LLlEjt3ocPcOOmmBsus.png"), "Arte da campanha Leve 3, Pague 2 da Los Neto")
	// fotos dos serviços: trabalhos reais da Time
	swapImg($, "ZVxgbkwUDvSV2GXTDCCNa8GEUaY", IMG("VRqhpjdkHBzoiJ0g7wEGQo6jE58.jpg"), "Papelaria da identidade visual de Claudia Coelho")
	swapImg($, "fksnpHLStk8PBWew2Gpj7IWk0nE", IMG("PNNdbsVq51EHgItYnZFaXmijM2U.jpg"), "Feed e identidade visual da MJ Engenharia")
	swapImg($, "CKlQCJTOqpT8sY07mVAnStWwJ0", IMG("fMZ050rQrQAkThBqSONumIQTsk.png"), "Anúncio da campanha de Zé Preto")
	swapImg($, "zMBDJ3iaj7fKXrbobixmRNCps", IMG("y4PoEAxH40JZyXwxPcoi0Z8RqPk.png"), "Peça gráfica: 4 motivos para investir em imóveis")
	swapImg($, "fwfmTxI85G1v3LMmEI5yhPmJiIA", IMG("HJhgKA70Ol2alObTQgIhZZeQJk.png"), "Área do cliente da Time no celular")
	// Sobre: fotos de banco do template -> equipe da Time em ação
	swapImg($, "olOjtvL78KPH3QrKMQyHd6JTQ7Y", IMG("85qbXilGmCLHxV8XUmZRtSPKmQo.jpeg"), "Gravação de vídeo da Agência Time")
	swapImg($, "sUZnn6TGtwsYPeNR8KknQbD5bI", IMG("PAOs7hYqv7budcaYzyHDF4kPTw.png"), "Edição de vídeo na Agência Time")
	// card "Gestão e transparência total": a onda de áudio (template de voz) vira um resumo de entregas
	$(".framer-5rTpm .framer-1kyml45-container").each((_, c) => {
		$(c).html(`<div class="tm-live" aria-hidden="true"><span class="tm-live-dot"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="tm-live-info"><span class="tm-live-row"><b>Campanha de verão</b><em>72%</em></span><i><span></span></i><small>3 entregas aprovadas hoje</small></span></div>`)
	})
}

/* ---------- rodapé: contato no lugar da newsletter + Behance e Google ---------- */
function footer($) {
	$(".framer-1x9kfky").each((_, col) => {
		const $c = $(col)
		const form = $c.children("form")
		if (!form.length) return
		const social = $c.closest("[class*=framer-fnx7o9], [data-framer-name=Right]").find(".framer-11pn9ct").first()
		$c.find("h4").first().find("span").first().text("Fale com a gente")
		if (social.length) {
			const list = social.clone()
			const items = list.children().toArray()
			const tpl = $(items[0]).clone()
			list.empty()
			for (const [text, href, ext] of [["(27) 99870-4892", WA_URL, true], ["agencia@agtime.com.br", "mailto:agencia@agtime.com.br"], ["Guarapari - ES", MAPS, true]]) {
				const it = tpl.clone().css("display", "")
				it.find("a").attr("href", href)
				if (ext) it.find("a").attr({ target: "_blank", rel: "noopener" }); else it.find("a").removeAttr("target")
				setText($, it.find("p").first(), text)
				list.append(it)
			}
			form.replaceWith(list)
		} else form.remove()
	})
	// Social: Behance (no lugar do "Youtube" do template) e avaliações no Google
	$(".framer-8c1gx3 .framer-11pn9ct").each((_, list) => {
		const $l = $(list)
		const items = $l.children().toArray()
		const ig = items.find((i) => /Instagram/.test($(i).text()))
		if (!ig) return
		$l.children().filter((_, i) => /Youtube|Behance|Google/.test($(i).text())).remove()
		for (const [text, href] of [["Behance", "https://www.behance.net/agtime"], ["Google", MAPS]]) {
			const it = $(ig).clone()
			it.find("a").attr({ href, target: "_blank", rel: "noopener" })
			setText($, it.find("p").first(), text)
			$l.append(it)
		}
	})
}

/* ---------- 4. SEO: título, descrição, imagem de compartilhamento, ícone, dados da empresa, alt ---------- */
const SITE = "https://www.agtime.com.br"
const META = {
	home: ["Agência Time | Marketing digital, branding e performance em Guarapari (ES)", "Agência de marketing em Guarapari (ES) há mais de 11 anos: branding, social media, tráfego pago, audiovisual, sites e IA. Estratégia, criação e performance para a sua marca crescer."],
	sobre: ["Sobre a Agência Time | Estratégia, criatividade e tecnologia", "Conheça a Agência Time: parceira de marcas que querem crescer com estratégia, criatividade e execução de ponta a ponta, com área do cliente e relatórios."],
	portfolio: ["Portfólio | Agência Time", "Projetos, campanhas e artes criados pela Agência Time para clientes como Los Neto, MJ Engenharia, DSN Seguros, Alma Cosméticos e outros."],
	contato: ["Contato | Agência Time", "Fale com a Agência Time pelo formulário ou pelo WhatsApp (27) 99870-4892. Atendemos marcas de todo o Brasil a partir de Guarapari (ES)."],
	404: ["Página não encontrada | Agência Time", "A página que você procura não existe ou mudou de endereço."],
}
const ALT = {
	fwfmTxI85G1v3LMm: "Código de site em desenvolvimento", "85qbXilGmCLHxV8X": "Gravação de vídeo da Agência Time", D2trK6TwZe9nUhFX: "Outdoor do Solar das Castanheiras da MJ Engenharia",
	hgm8dnsEnVWdsHy4: "Estação de trabalho com site em desenvolvimento", "2B9epNjEFC04KKip": "Gravação de vídeo com câmera profissional", BZlJuvebcsZzBzLK: "Ensaio fotográfico profissional",
	ITy6z6DXdwdwPtQe: "Equipe da Time em gravação", PAOs7hYqv7budcaY: "Edição de vídeo na Agência Time", VRqhpjdkHBzoiJ0g: "Papelaria da identidade visual de Claudia Coelho",
	HJhgKA70Ol2alObT: "Área do cliente da Time no celular", NYmEtUx5ww4gKQef: "Fachada da loja Alma Cosméticos", oT9aaAcOUFAYZBOw: "Ensaio fotográfico profissional",
	c7Joo9eC5qmrHFzP: "Escritório com estações de trabalho", SmKpJArNfpH0J4Yg: "Trabalho de design no computador", "0wHjUWkfWuYogfvA": "Câmera de cinema em gravação",
	tD84WiYcwh6f25dC: "Ensaio da campanha de Dia das Mães da Los Neto", "7Bg7749u9LPwxS9R": "Fotógrafa em gravação externa", "437WCNUlG8nxkF48": "Fotógrafa com câmera",
	qKap5IoBxQ2GJCJ1: "Gravação aérea com drone", "0xaFWu0WktUahswA": "Espazzo Móveis Conceito", kHlcXnpTjBKkAKqW: "CRC Evans", XQ73mMPXZK1tjIvI: "Los Sport", Vk6eYMrX7A0Le7K4: "Los Neto",
	vwn10rFvhHcBPIYl: "Agência Time",
}
const TEMPLATE_ALT = /^(Perfume Bottle|Woman Zoom Shot|Container|Villa|Man Wearing Glasses|Car Front|Scent Bottle|Woman In Garden|Man And A Car|Woman|Verified|Car|Paper Floating|Man|Man Using Laptop|Woman Using Laptop|Team Working|Logo|Zoom|User|Image)$/
function seo($, ctx) {
	const [title, desc] = META[ctx.id] || []
	if (title) {
		$("title").text(title)
		$('meta[property="og:title"], meta[name="twitter:title"]').attr("content", title)
	}
	if (desc) $('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').attr("content", desc)
	// imagem de compartilhamento horizontal (as páginas de projeto usam a imagem do próprio projeto)
	if (!ctx.ogImage) {
		$('meta[property="og:image"], meta[name="twitter:image"]').attr("content", SITE + "/_assets/custom/og-agencia-time.jpg").removeAttr("data-abs-asset")
		$('meta[property="og:image"]').after('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Agência Time: criando com propósito e inteligência criativa">')
	}
	$('meta[name="twitter:card"]').attr("content", "summary_large_image")
	$('meta[property="og:site_name"]').remove()
	$('meta[property="og:type"]').after('<meta property="og:site_name" content="Agência Time"><meta property="og:locale" content="pt_BR">')
	// ícone visível em abas claras e escuras
	$('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').remove()
	$("head").append('<link rel="icon" type="image/png" sizes="32x32" href="/_assets/custom/icon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/_assets/custom/icon-192.png"><link rel="apple-touch-icon" href="/_assets/custom/icon-180.png"><meta name="theme-color" content="#050604">')
	// dados da empresa para o Google (endereço, horário, contato)
	if (ctx.id === "home" || ctx.id === "contato") {
		const ld = {
			"@context": "https://schema.org", "@type": "ProfessionalService", name: "Agência Time", url: SITE + "/", logo: SITE + "/_assets/custom/icon-512.png", image: SITE + "/_assets/custom/og-agencia-time.jpg",
			description: META.home[1], telephone: "+55 27 99870-4892", email: "agencia@agtime.com.br",
			address: { "@type": "PostalAddress", streetAddress: "Av. Padre José de Anchieta, 1355 - Sl 1 - Aeroporto", addressLocality: "Guarapari", addressRegion: "ES", postalCode: "29216-705", addressCountry: "BR" },
			geo: { "@type": "GeoCoordinates", latitude: -20.6443156, longitude: -40.487389 },
			openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00" }],
			sameAs: ["https://www.instagram.com/agtime.oficial/", "https://www.behance.net/agtime", MAPS],
			areaServed: "BR",
		}
		$("head").append(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
	}
	// descrições das imagens
	$("img").each((_, i) => {
		const $i = $(i), src = $i.attr("src") || ""
		const key = Object.keys(ALT).find((k) => src.includes(k))
		if (key) $i.attr("alt", ALT[key])
		else if (TEMPLATE_ALT.test(($i.attr("alt") || "").trim())) $i.attr("alt", "")
		else if ($i.attr("alt") == null) $i.attr("alt", "")
	})
}

export function applyFixes(ctx) {
	const { $ } = ctx
	links($, ctx)
	texts($, ctx)
	images($, ctx)
	footer($)
	seo($, ctx)
}
