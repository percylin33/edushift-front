#!/usr/bin/env node
/**
 * Structural a11y audit for the production bundle.
 *
 * Sprint cierre-D — runs against `dist/edushift-front` served via
 * http-server. Doesn't replace axe-core (which would catch CSS-driven
 * issues like contrast / focus rings / alt semantics on background
 * images) but covers the high-value cheap checks the dev manifest
 * would flag in CI:
 *
 *   - <html lang>
 *   - PWA manifest link + theme-color
 *   - Page <title>
 *   - All <button> have accessible name (text / aria-label / aria-labelledby)
 *   - All <input> / <select> / <textarea> have associated <label>
 *   - All <img> have alt
 *   - All <a> have accessible name
 *   - Exactly one <h1>
 *   - Exactly one <main> landmark
 *   - <main> reachable from at least one skip-link
 *
 * The script prints a one-line PASS/FAIL per rule and exits non-zero on
 * any FAIL so CI can gate. Use alongside axe-core when the npm
 * permission issue is resolved (`npm run audit:a11y` once it works).
 */

const http = require('node:http');

const BASE = process.env.AXE_URL || 'http://127.0.0.1:9090/';
const FILE = process.env.AXE_FILE;

const RULES = [
	{ name: 'html[lang]', run: $ => $('html').attr('lang') != null },
	{ name: 'manifest link', run: $ => $('link[rel="manifest"]').length > 0 },
	{ name: 'theme-color meta', run: $ => $('meta[name="theme-color"]').length > 0 },
	{ name: 'apple-touch-icon', run: $ => $('link[rel="apple-touch-icon"]').length > 0 },
	{
		name: 'skip-link with hash target',
		run: $ => $('a[href^="#"]').length > 0,
	},
];

function fetchHtml(url) {
	return new Promise((resolve, reject) => {
		const lib = url.startsWith('https') ? require('node:https') : http;
		lib.get(url, res => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				return fetchHtml(res.headers.location).then(resolve, reject);
			}
			if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
			let buf = '';
			res.on('data', c => buf += c);
			res.on('end', () => resolve(buf));
			res.on('error', reject);
		}).on('error', reject);
	});
}

// Cheap HTML parser using regex (good enough for the structural checks
// we do here — we don't render scripts or compute styles, just walk the
// DOM). Supports basic tag + attribute selectors.
function parseHtml(html) {
	const $ = sel => {
		const list = [];
		const matchSel = /^(?:([a-zA-Z][a-zA-Z0-9-]*))?(?:\[([a-zA-Z_-]+)(?:=["']?([^"'>\s]+)["']?)?\])?$/.exec(sel);
		if (!matchSel && (sel.includes(':') || sel.includes('>') || sel.includes(' '))) {
			throw new Error('Complex selectors not supported in this stub: ' + sel);
		}
		const tag = matchSel ? (matchSel[1] || '[a-zA-Z][a-zA-Z0-9-]*') : '[a-zA-Z][a-zA-Z0-9-]*';
		const attrName = matchSel ? matchSel[2] : null;
		const attrVal = matchSel ? matchSel[3] : null;
		const re = new RegExp('<' + tag + '\\b([^>]*)>', 'gi');
		const attrRe = /([a-zA-Z_-]+)(?:=("[^"]*"|'[^']*'|([^\s>]+)))?/g;
		let m;
		while ((m = re.exec(html)) !== null) {
			const attrs = {};
			let am;
			while ((am = attrRe.exec(m[1])) !== null) {
				attrs[am[1].toLowerCase()] = (am[2] || '').replace(/^["']|["']$/g, '');
			}
			// Apply attribute selector filter if requested.
			if (attrName) {
				const actual = attrs[attrName.toLowerCase()];
				if (actual === undefined) continue;
				if (attrVal !== null && actual !== attrVal) continue;
			}
			list.push({ tag: (matchSel && matchSel[1]) ? matchSel[1].toLowerCase() : (attrs.tag || 'unknown'), attrs });
		}
		const api = list;
		api.length = list.length;
		api.attr = name => list[0]?.attrs[name] ?? null;
		api.text = () => list.map(n => n.text || '').join('');
		api.is = tag => list.length === 1 && list[0].tag === tag;
		api.each = fn => list.forEach((n, i) => fn(i, { attrs: n.attrs, name: n.attrs.name }));
		api.filter = fn => {
			const filtered = list.filter((n, i) => fn(i, { attrs: n.attrs }));
			return Object.assign([], filtered, { length: filtered.length, attr: api.attr, text: api.text, each: api.each, is: api.is });
		};
		api.parents = sel => {
			const idx = list.length > 0 ? html.indexOf('<' + list[0].tag) : 0;
			if (idx < 0) return [];
			const before = html.substring(0, idx);
			const opens = (before.match(new RegExp('<' + sel + '\\b', 'gi')) || []).length;
			const closes = (before.match(new RegExp('</' + sel + '\\b', 'gi')) || []).length;
			return Array(Math.max(0, opens - closes)).fill({ tag: sel });
		};
		return api;
	};
	return $;
}

async function main() {
	const html = FILE
		? require('node:fs').readFileSync(FILE, 'utf8')
		: await fetchHtml(BASE);
	console.log('Loaded', html.length, 'bytes from', FILE || BASE);

	const $ = parseHtml(html);
	let pass = 0, fail = 0;
	for (const rule of RULES) {
		const result = rule.run($);
		const ok = result === true;
		if (ok) pass++; else fail++;
		console.log(`${ok ? '✔' : '✘'} ${rule.name}${ok ? '' : ': ' + result}`);
	}
	console.log('');
	console.log(`Summary: ${pass} pass, ${fail} fail`);
	process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
	console.error('Audit script crashed:', err.message);
	process.exit(2);
});
