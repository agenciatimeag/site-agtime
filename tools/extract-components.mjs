// Extrai as propriedades dos componentes de código do Framer que precisam ser recriados
// (Ticker, Light Rays, cursores) a partir dos módulos JS capturados.
// Saída: capture/components.json
import fs from "node:fs"
import path from "node:path"
import * as acorn from "acorn"
import * as walk from "acorn-walk"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const DIR = path.join(ROOT, "capture/js")

// valor literal simples de um nó (string, número, boolean, objetos/arrays literais)
function lit(n, src) {
	if (!n) return undefined
	switch (n.type) {
		case "Literal": return n.value
		case "TemplateLiteral": return n.expressions.length ? undefined : n.quasis.map((q) => q.value.cooked).join("")
		case "UnaryExpression":
			if (n.operator === "!" && n.argument.type === "Literal") return !n.argument.value
			if (n.operator === "-" && n.argument.type === "Literal") return -n.argument.value
			return undefined
		case "ObjectExpression": {
			const o = {}
			for (const p of n.properties) {
				if (p.type !== "Property") continue
				const k = p.key.type === "Identifier" ? p.key.name : p.key.value
				const v = lit(p.value, src)
				if (v !== undefined) o[k] = v
			}
			return o
		}
		case "ArrayExpression": return n.elements.map((e) => lit(e, src))
		default: return undefined
	}
}
const propOf = (obj, name) => obj.properties.find((p) => p.type === "Property" && (p.key.name === name || p.key.value === name))

const out = { tickers: {}, lightRays: {}, cursors: {} }
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".mjs"))) {
	const src = fs.readFileSync(path.join(DIR, f), "utf8")
	let ast
	try { ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" }) } catch (e) { continue }
	const assigned = {}
	walk.simple(ast, {
		VariableDeclarator(n) { if (n.id.type === "Identifier" && n.init) assigned[n.id.name] = n.init },
		AssignmentExpression(n) { if (n.left.type === "Identifier") assigned[n.left.name] = n.right },
	})
	walk.ancestor(ast, {
		ObjectExpression(n, _st, anc) {
			const has = (k) => !!propOf(n, k)
			const kind = has("hoverFactor") && has("direction") ? "tickers" : has("rays") && has("raysColor") ? "lightRays" : null
			if (!kind) return
			// sobe até o objeto de props com className "...-container"
			let container = null, style = null
			for (let i = anc.length - 2; i >= 0; i--) {
				const a = anc[i]
				if (a.type !== "ObjectExpression") continue
				const cn = propOf(a, "className")
				const v = cn && lit(cn.value)
				if (typeof v === "string" && /-container$/.test(v)) { container = v; const st = propOf(a, "style"); style = st ? lit(st.value) : null; break }
			}
			if (!container) return
			const props = {}
			for (const p of n.properties) {
				if (p.type !== "Property") continue
				const k = p.key.name || p.key.value
				if (k === "slots" || k === "children") continue
				const v = lit(p.value)
				if (v !== undefined) props[k] = v
			}
			if (style && style.opacity != null) props.containerOpacity = style.opacity
			out[kind][container] = props
		},
		CallExpression(n) {
			// registro de cursores: x({"1bf4dyq":Nl,"8bnwio":Pl})
			const a = n.arguments[0]
			if (n.arguments.length !== 1 || !a || a.type !== "ObjectExpression" || !a.properties.length) return
			if (!a.properties.every((p) => p.type === "Property" && p.key.type === "Literal" && /^[a-z0-9]{5,8}$/.test(p.key.value) && p.value.type === "Identifier")) return
			for (const p of a.properties) {
				const init = assigned[p.value.name]
				if (!init || init.type !== "ObjectExpression" || !propOf(init, "component")) continue
				const conf = {}
				for (const q of init.properties) {
					const k = q.key.name || q.key.value
					if (k === "component") continue
					let v = lit(q.value)
					if (v === undefined && q.value.type === "Identifier" && assigned[q.value.name]) v = lit(assigned[q.value.name])
					if (v !== undefined) conf[k] = v
				}
				out.cursors[p.key.value] = out.cursors[p.key.value] || conf
			}
		},
	})
}
fs.writeFileSync(path.join(ROOT, "capture/components.json"), JSON.stringify(out, null, 1))
console.log("tickers", Object.keys(out.tickers).length, "lightRays", Object.keys(out.lightRays).length, "cursors", JSON.stringify(out.cursors))
