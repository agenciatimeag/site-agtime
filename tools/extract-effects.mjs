// Reads Framer's compiled page/component modules and extracts animation settings per CSS class.
// Output: capture/effects.json
import fs from "node:fs"
import path from "node:path"
import * as acorn from "acorn"
import * as walk from "acorn-walk"

const DIR = "capture/js"
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".mjs"))
const KEEP = /^(__framer__\w*|__targetOpacity|__perspectiveFX|__smartComponentFX|whileHover|whileTap|whileInView|animate|initial|exit|variants|transition|data-framer-appear-id|style|speed|hoverFactor|direction|alignment|gap|padding|sizingOptions|fadeOptions|effect|data-framer-name)$/
const out = { elements: {}, components: [], unresolved: 0 }
const keyOf = (p) => (p.key.type === "Identifier" ? p.key.name : p.key.value)

function evalNode(node, scope, depth = 0) {
	if (!node || depth > 14) return undefined
	switch (node.type) {
		case "Literal": return node.value
		case "TemplateLiteral": return node.expressions.length ? node.quasis.map((q) => q.value.cooked).join("${}") : node.quasis[0].value.cooked
		case "UnaryExpression": {
			const v = evalNode(node.argument, scope, depth + 1)
			if (node.operator === "!") return typeof v === "object" ? undefined : !v
			if (node.operator === "-") return typeof v === "number" ? -v : undefined
			return undefined
		}
		case "Identifier": {
			const d = scope.get(node.name)
			if (!d) { out.unresolved++; return { $ref: node.name } }
			return evalNode(d, scope, depth + 1)
		}
		case "ArrayExpression": return node.elements.map((e) => evalNode(e, scope, depth + 1))
		case "ObjectExpression": {
			const o = {}
			for (const p of node.properties) {
				if (p.type === "SpreadElement") { const v = evalNode(p.argument, scope, depth + 1); if (v && typeof v === "object" && !v.$ref) Object.assign(o, v); continue }
				const k = keyOf(p)
				if (k === "children") continue
				o[k] = evalNode(p.value, scope, depth + 1)
			}
			return o
		}
		case "ConditionalExpression": return { $cond: [evalNode(node.consequent, scope, depth + 1), evalNode(node.alternate, scope, depth + 1)] }
		default: return undefined
	}
}

const isFn = (n) => n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression"

for (const f of files) {
	const src = fs.readFileSync(path.join(DIR, f), "utf8")
	if (!src.includes("framer-")) continue
	let ast
	try { ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module" }) } catch { continue }
	const scope = new Map()
	const assignAt = new Map()
	walk.simple(ast, {
		VariableDeclarator(d) { if (d.id.type === "Identifier" && d.init && !scope.has(d.id.name)) { scope.set(d.id.name, d.init); assignAt.set(d.id.name, d.end) } },
		AssignmentExpression(a) { if (a.operator === "=" && a.left.type === "Identifier" && !scope.has(a.left.name)) { scope.set(a.left.name, a.right); assignAt.set(a.left.name, a.end) } },
	})

	// 1) components: every useVariantState({cycleOrder, variantClassNames, ...}) call, scoped to its enclosing function
	const compByFn = new Map()
	walk.ancestor(ast, {
		ObjectExpression(node, _s, anc) {
			const keys = node.properties.filter((p) => p.type === "Property").map(keyOf)
			if (!(keys.includes("variantClassNames") && keys.includes("cycleOrder"))) return
			const fn = [...anc].reverse().find(isFn)
			const o = evalNode(node, scope)
			const comp = { module: f, scopes: new Set(), ...o }
			const co = node.properties.find((p) => p.type === "Property" && keyOf(p) === "cycleOrder")
			if (co && co.value.type === "Identifier" && assignAt.has(co.value.name)) {
				const m = src.slice(assignAt.get(co.value.name), assignAt.get(co.value.name) + 600).match(/[`"'](framer-[A-Za-z0-9]{5})[`"']/)
				if (m) comp.scopes.add(m[1])
			}
			delete comp.ref; delete comp.variant
			compByFn.set(fn, comp)
		},
	})
	for (const [fn, comp] of compByFn) {
		if (comp.scopes.size) continue
		walk.full(fn, (n) => {
			const s = n.type === "Literal" && typeof n.value === "string" ? n.value : n.type === "TemplateElement" ? n.value.cooked : null
			if (!s) return
			for (const c of s.match(/framer-[A-Za-z0-9]{5}\b/g) || []) if (/[A-Z]/.test(c)) comp.scopes.add(c)
		})
	}

	// 2) elements with effects
	walk.ancestor(ast, {
		ObjectExpression(node, _s, anc) {
			const keys = node.properties.filter((p) => p.type === "Property").map(keyOf)
			if (!keys.includes("className")) return
			const interesting = keys.filter((k) => KEEP.test(k) && !["style", "data-framer-name", "transition"].includes(k))
			if (!interesting.length) return
			const cn = node.properties.find((p) => p.type === "Property" && keyOf(p) === "className")
			const classes = []
			walk.full(cn.value, (n) => {
				if (n.type === "Literal" && typeof n.value === "string") classes.push(...(n.value.match(/framer-[A-Za-z0-9-]+/g) || []))
				if (n.type === "TemplateElement") classes.push(...(n.value.cooked.match(/framer-[A-Za-z0-9-]+/g) || []))
			})
			if (!classes.length) return
			const props = {}
			for (const p of node.properties) {
				if (p.type !== "Property") continue
				const k = keyOf(p)
				if (!KEEP.test(k)) continue
				const v = evalNode(p.value, scope)
				if (k === "style") {
					if (v && typeof v === "object") { const s = {}; for (const [sk, sv] of Object.entries(v)) if (/^(opacity|rotate|rotateX|rotateY|scale|x|y|skewX|skewY|backgroundColor|color|transformPerspective|filter|WebkitFilter)$/.test(sk)) s[sk] = sv; if (Object.keys(s).length) props.style = s }
					continue
				}
				props[k] = v
			}
			const fn = [...anc].reverse().find((a) => compByFn.has(a))
			if (fn) props.comp = [...compByFn.get(fn).scopes][0] || null
			for (const c of classes) (out.elements[c] ||= []).push({ m: f, ...props })
		},
	})
	for (const comp of compByFn.values()) out.components.push({ ...comp, scopes: [...comp.scopes] })
}
fs.writeFileSync("capture/effects.json", JSON.stringify(out, null, 1))
const counts = {}
for (const arr of Object.values(out.elements)) for (const e of arr) for (const k of Object.keys(e)) counts[k] = (counts[k] || 0) + 1
console.log("classes with effects:", Object.keys(out.elements).length, "components:", out.components.length, "unresolved refs:", out.unresolved)
console.log(JSON.stringify(counts))
console.log("components with gestures:", out.components.filter((c) => c.enabledGestures && Object.keys(c.enabledGestures).length).map((c) => c.scopes.join("/") + ":" + JSON.stringify(c.enabledGestures)).join("\n"))
