export const PALETTE_KEY = "mod+.";
export const SEQUENCE_TIMEOUT = 1000;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);
const NAMED_KEYS = { Escape: "esc", Enter: "enter", ArrowUp: "up", ArrowDown: "down" };

export function chord(event, is_mac) {
	if (MODIFIER_KEYS.has(event.key)) return null;
	const mod = is_mac ? event.metaKey : event.ctrlKey;
	const foreign = is_mac ? event.ctrlKey : event.metaKey;
	if (foreign || event.altKey) return null;
	const named = NAMED_KEYS[event.key];
	const key = named || (event.key || "").toLowerCase();
	if (!key) return null;
	const parts = [];
	if (mod) parts.push("mod");
	const is_letter = /^[a-z]$/.test(key);
	if (event.shiftKey && (named || is_letter)) parts.push("shift");
	parts.push(key);
	return parts.join("+");
}

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range"]);

export function is_typing_target(element) {
	if (!element) return false;
	if (element.isContentEditable) return true;
	if (element.tagName === "INPUT") {
		return !NON_TEXT_INPUTS.has(String(element.type || "text").toLowerCase());
	}
	return ["TEXTAREA", "SELECT"].includes(element.tagName);
}

export class Sequences {
	constructor(bindings, timeout = SEQUENCE_TIMEOUT) {
		this.bindings = bindings;
		this.timeout = timeout;
		this.reset();
	}

	reset() {
		this.prefix = null;
		this.started = 0;
	}

	options(prefix) {
		return this.bindings.filter((b) => b.keys[0] === prefix);
	}

	feed(key, now) {
		if (this.prefix && now - this.started <= this.timeout) {
			const prefix = this.prefix;
			this.reset();
			const binding = this.bindings.find((b) => b.keys[0] === prefix && b.keys[1] === key);
			return binding ? { status: "match", binding } : { status: "none" };
		}
		this.reset();
		const options = this.options(key);
		if (!options.length) return { status: "none" };
		this.prefix = key;
		this.started = now;
		return { status: "pending", prefix: key, options };
	}
}

function subsequence_score(query, text) {
	let position = 0;
	let gaps = 0;
	for (const char of query) {
		const found = text.indexOf(char, position);
		if (found === -1) return 0;
		gaps += found - position;
		position = found + 1;
	}
	return Math.max(1, 100 - gaps);
}

export function score(query, text) {
	query = (query || "").trim().toLowerCase();
	text = (text || "").toLowerCase();
	if (!query) return 1;
	if (text === query) return 1000;
	if (text.startsWith(query)) return 800;
	const words = text.split(/[\s\-/&·]+/);
	if (words.some((word) => word.startsWith(query))) return 600;
	const index = text.indexOf(query);
	if (index !== -1) return 400 - Math.min(index, 100);
	const tokens = query.split(/\s+/);
	if (tokens.length > 1 && tokens.every((t) => text.includes(t))) return 300;
	return subsequence_score(query.replace(/\s+/g, ""), text);
}

export function rank(query, items, text_of, limit = Infinity) {
	return items
		.map((item, index) => ({ item, index, score: score(query, text_of(item)) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.slice(0, limit)
		.map((entry) => entry.item);
}

const CTRL_MOVES = { j: "next", n: "next", k: "prev", p: "prev" };
const ARROW_MOVES = { ArrowDown: "down", ArrowUp: "up" };
const LIST_MOVES = { j: "down", k: "up" };
const EDIT_KEYS = new Set(["Backspace", "Delete"]);

export function search_action(event, in_list, is_mac) {
	if (event.isComposing || event.altKey || event.metaKey) return null;
	const key = event.key || "";
	if (event.ctrlKey)
		return is_mac && !event.shiftKey ? CTRL_MOVES[key.toLowerCase()] || null : null;
	if (key === "Tab") return event.shiftKey ? (in_list ? "input" : null) : "list";
	if (ARROW_MOVES[key]) return event.shiftKey ? null : ARROW_MOVES[key];
	if (!in_list) return null;
	if (key === "Escape") return "input";
	if (key === "Enter") return "open";
	if (!event.shiftKey && LIST_MOVES[key]) return LIST_MOVES[key];
	if (key.length === 1 || EDIT_KEYS.has(key)) return "type";
	return null;
}

export const SEARCH_MOVES = { next: 1, down: 1, prev: -1, up: -1 };

export function search_list_mode(action, in_list) {
	if (["down", "up", "list"].includes(action)) return true;
	if (["input", "type", "open"].includes(action)) return false;
	return in_list;
}

export function chip_index(event) {
	if (!event || event.altKey || !(event.metaKey || event.ctrlKey)) return -1;
	const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code || "") || /^([1-9])$/.exec(event.key || "");
	return match ? Number(match[1]) - 1 : -1;
}

export function step(index, length, delta) {
	if (!length) return -1;
	if (index < 0) return delta > 0 ? 0 : length - 1;
	return Math.min(length - 1, Math.max(0, index + delta));
}

export function recent_refs(history, doctypes, limit = 8) {
	const seen = new Set();
	const refs = [];
	for (let i = history.length - 1; i >= 0 && refs.length < limit; i--) {
		const [view, doctype, name] = history[i] || [];
		if (view !== "Form" || !doctypes.includes(doctype) || !name) continue;
		if (String(name).startsWith("new-")) continue;
		const key = `${doctype}\u0000${name}`;
		if (seen.has(key)) continue;
		seen.add(key);
		refs.push([doctype, name]);
	}
	return refs;
}

export function visible(query, items, text_of, min_score, limit) {
	if (!query) return items;
	const matching = items.filter((item) => score(query, text_of(item)) >= min_score);
	return rank(query, matching, text_of, limit);
}

export class PaletteState {
	constructor() {
		this.query = "";
		this.records = {};
		this.recent = [];
		this.query_token = 0;
		this.recent_token = 0;
	}

	begin_recent() {
		return ++this.recent_token;
	}

	accept_recent(token, recent) {
		if (token !== this.recent_token) return false;
		this.recent = recent;
		return true;
	}

	set_query(query) {
		this.query = query;
		this.records = {};
		return ++this.query_token;
	}

	accept_records(token, records) {
		if (token !== this.query_token) return false;
		this.records = records;
		return true;
	}

	close() {
		this.query_token++;
		this.recent_token++;
	}
}
