// Ajustes específicos de cada página (conteúdo novo que estava só no editor do Framer).
import fs from "node:fs"
import path from "node:path"
import { registerPage, replaceTexts, setText, consts } from "./patches.mjs"
import { homePortfolio, portfolioPage } from "./portfolio.mjs"

const { WHATS, MAPS, ROOT } = consts
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8")
const PORTAL = read("tools/snippets/portal.html")
const GOOGLE_PATH = "M224,128a96,96,0,1,1-21.95-61.09,8,8,0,1,1-12.33,10.18A80,80,0,1,0,207.6,136H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128Z"

const REVIEWS = [
	{ match: /They not only delivered/, name: "Luiza Souza", avatar: "/_assets/custom/avatar-ls.svg", text: "“Equipe criativa e muito dedicada. Os vídeos que eles produzem são de alta qualidade e realmente capturaram a essência da minha marca. Obrigada mais uma vez e ansiosa para os próximos trabalhos.”" },
	{ match: /The team understood/, name: "Bianca Monteiro", avatar: "/_assets/custom/avatar-bm.svg", text: "“Empresa impecável, inovação, tecnologia, atendimento enfim estão de parabéns.”" },
	{ match: /Their innovative solutions/, name: "Isabela Koniczna", avatar: "/_assets/custom/avatar-ik.svg", text: "“Empresa muito comprometida, gostei muito dos serviços!”" },
]

function testimonials($) {
	$("a.framer-aXCET").each((_, card) => {
		const $c = $(card)
		const q = $c.find(".framer-grnuo9 p").text()
		const r = REVIEWS.find((x) => x.match.test(q))
		// o "container" do card (e a variante de breakpoint que só tem ele)
		let box = $c.closest("[class*=-container]")
		if (!r) {
			const v = box.parent(".ssr-variant")
			;(v.length && v.children().length === 1 ? v : box).remove()
			return
		}
		$c.attr({ href: MAPS, target: "_blank", rel: "noopener" })
		$c.find(".framer-1a3419c img").attr({ src: r.avatar, alt: r.name }).removeAttr("srcset")
		$c.find(".framer-dgrz5q path").attr("d", GOOGLE_PATH)
		setText($, $c.find(".framer-grnuo9 p"), r.text)
		setText($, $c.find(".framer-8wcjjw p"), r.name)
		setText($, $c.find(".framer-1i4hpao p"), "Cliente")
		setText($, $c.find(".framer-ggpxzr p"), "Avaliação 5 estrelas no Google")
	})
}

// Seção "Área do Cliente": o vídeo do template dá lugar à animação do portal (Orkestrya)
function portal($) {
	$(".framer-vylere").each((_, v) => {
		if (!$(v).find("video").length) return
		$(v).html(PORTAL)
	})
}

registerPage("home", (ctx) => {
	const { $ } = ctx
	homePortfolio(ctx)
	testimonials($)
	portal($)
})

/* ---------------- Sobre ---------------- */
const SOBRE = {
	"Innovate": "Estratégia",
	"Built for Cutting-Edge AI Teams": "Planejamento antes de qualquer peça",
	"AI Agency": "Diagnóstico",
	"Future Ready": "Dados",
	"Trust": "Confiança",
	"Designed to Build Instant Trust": "Transparência do início ao fim",
	"Trust By Design": "Área do cliente",
	"Modern UX": "Relatórios",
	"Scale": "Crescimento",
	"Scales With Your Vision": "Uma estrutura que cresce com você",
	"Empowering Brands": "Sobre a Time",
	"Effortlessly connect with your favorite tools. Whether it's your CRM, email marketing platform.": "Conectamos a sua marca às ferramentas que você já usa, do CRM ao e-mail marketing.",
	"Each Project, Our": "Cada projeto,",
	"Design is Great.": "um design marcante.",
}
const SOBRE_SUB = [
	[/^Whether you're developing LLMs.*$/s, "Antes de criar, entendemos o seu negócio, o seu público e os seus objetivos. É esse diagnóstico que orienta cada campanha, conteúdo e investimento em mídia."],
	[/^Nubien is crafted with clean typography.*$/s, "Você acompanha demandas, aprovações, cronogramas e relatórios pela nossa área do cliente, sem precisar caçar informação em vários canais."],
	[/^From product launches to team showcases.*$/s, "Branding, social media, tráfego pago, audiovisual, sites e IA no mesmo lugar. Conforme a sua marca cresce, a operação acompanha."],
]
function regexTexts($, list) {
	$("body").find("p, h1, h2, h3, h4, h5, h6").each((_, el) => {
		const t = $(el).text().trim()
		for (const [re, to] of list) if (re.test(t)) { setText($, el, to); break }
	})
}

registerPage("sobre", (ctx) => {
	const { $ } = ctx
	replaceTexts($, "body", SOBRE, [])
	regexTexts($, SOBRE_SUB)
	// vídeo do template (assistente de IA) -> foto da equipe
	$("video").each((_, v) => {
		const box = $(v).closest("[class*=framer-]")
		const holder = box.closest(".framer-1ljqxsk").length ? box.closest(".framer-1ljqxsk") : box.parent()
		holder.html(`<img src="https://framerusercontent.com/images/ITy6z6DXdwdwPtQeV4o0Djdl0.jpeg?scale-down-to=2048&width=3224&height=4836" alt="Equipe da Time em gravação, com a camiseta “É melhor ir com um time foda!”" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 58%;border-radius:inherit" decoding="async">`)
	})
	// botão "Agendar uma conversa" do 3º card leva ao contato
	$("a").filter((_, a) => /Agendar uma conversa/.test($(a).text())).attr("href", "/contato")
})

/* ---------------- Contato ---------------- */
const ESTADOS = ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"]
const SEGMENTOS = ["Saúde e clínicas", "Varejo e lojas", "Alimentação", "Construção e engenharia", "Imobiliário", "Beleza e estética", "Educação", "Serviços", "Indústria", "Política", "Outro"]
const opts = (ph, list) => `<option value="" disabled selected>${ph}</option>` + list.map((x) => `<option value="${x}">${x}</option>`).join("")

registerPage("contato", (ctx) => {
	const { $ } = ctx
	const f = $("form.framer-65elbn")
	f.attr("data-whatsapp-intro", "Olá! Vim pelo site da Agência Time e quero solicitar um contato.")
	const inputs = f.find("input.framer-form-input, textarea.framer-form-input, select.framer-form-input").toArray()
	const conf = [
		{ name: "Nome", ph: "Seu nome", type: "text", ac: "given-name" },
		{ name: "Sobrenome", ph: "Seu sobrenome", type: "text", ac: "family-name" },
		{ name: "WhatsApp", ph: "27 9 9999 - 9999", type: "tel", ac: "tel" },
		{ name: "Estado", select: opts("Selecione seu estado", ESTADOS) },
		{ name: "Segmento", select: opts("Selecione o segmento", SEGMENTOS) },
		{ name: "Mensagem", ph: "Escreva sua mensagem..." },
	]
	inputs.forEach((el, i) => {
		const c = conf[i]
		if (!c) return
		const $el = $(el)
		$el.attr("name", c.name).attr("required", "")
		if (c.select) $el.html(c.select)
		else {
			$el.attr("placeholder", c.ph)
			if (c.type) $el.attr("type", c.type)
			if (c.ac) $el.attr("autocomplete", c.ac)
		}
	})
})

/* ---------------- Portfólio ---------------- */
registerPage("portfolio", (ctx) => portfolioPage(ctx))

/* ---------------- 404 ---------------- */
registerPage("404", (ctx) => {
	const { $ } = ctx
	replaceTexts($, "body", { "Oops! The web page you’re looking for doesn’t exist. Please click the below button to get back to the home.": "A página que você procura não existe ou mudou de endereço. Volte para a página inicial e continue navegando." }, [])
	$("title").text("Página não encontrada | Agência Time")
	$("head").append('<meta name="robots" content="noindex">')
})
