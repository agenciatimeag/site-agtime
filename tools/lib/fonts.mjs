// O Framer declara a DM Sans várias vezes (pesos estáticos 500/700/900 e a versão variável),
// e na captura alguns desses arquivos ficaram com o mesmo nome local, sobrescrevendo uns aos outros:
// o arquivo que sobrou só tem acentos (latin-ext), então rótulos e campos caíam na fonte reserva
// (Arial ou serifada) e só o "A" aparecia em DM Sans. Aqui trocamos tudo pela DM Sans variável
// (pesos 100–1000), que está íntegra, em latin + latin-ext, normal e itálico.

const F = "/_assets/fonts/"
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"
const face = (file, style, range) =>
	`@font-face{font-family:"DM Sans";src:url("${F}${file}") format("woff2");font-weight:100 1000;font-style:${style};font-display:swap;unicode-range:${range}}`

export const DM_SANS_CSS = [
	face("rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2", "normal", LATIN),
	face("rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6h.woff2", "normal", LATIN_EXT),
	face("rP2Wp2ywxg089UriCZaSExd86J3t9jz86MvyyKy5.woff2", "italic", LATIN),
	face("rP2Wp2ywxg089UriCZaSExd86J3t9jz86MvyyKK5.woff2", "italic", LATIN_EXT),
].join("\n")

export function fixFonts(html) {
	html = html.replace(/@font-face\s*\{[^}]*font-family:\s*["']?DM Sans["']?\s*;[^}]*\}/g, "")
	return html.replace(/<head([^>]*)>/i, `<head$1><style data-fonts>${DM_SANS_CSS}</style>`)
}
