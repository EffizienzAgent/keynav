import test from "node:test";
import assert from "node:assert/strict";
import {
	chip_index,
	chord,
	is_typing_target,
	PaletteState,
	rank,
	recent_refs,
	score,
	search_action,
	search_list_mode,
	Sequences,
	step,
	visible,
} from "./core.js";

const key = (k, mods = {}) => ({
	key: k,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...mods,
});

test("chord maps Cmd on Mac and Ctrl elsewhere to mod", () => {
	assert.equal(chord(key(".", { metaKey: true }), true), "mod+.");
	assert.equal(chord(key(".", { ctrlKey: true }), false), "mod+.");
	assert.equal(chord(key(".", { ctrlKey: true }), true), null);
	assert.equal(chord(key(".", { metaKey: true }), false), null);
	assert.equal(chord(key("Enter", { metaKey: true }), true), "mod+enter");
});

test("chord keeps symbols layout independent and ignores bare modifiers", () => {
	assert.equal(chord(key("?", { shiftKey: true }), true), "?");
	assert.equal(chord(key("/", { shiftKey: true }), true), "/");
	assert.equal(chord(key("G"), true), "g");
	assert.equal(chord(key("G", { shiftKey: true }), true), "shift+g");
	assert.equal(chord(key("Escape"), true), "esc");
	assert.equal(chord(key("Shift", { shiftKey: true }), true), null);
	assert.equal(chord(key("g", { altKey: true }), true), null);
});

test("typing targets", () => {
	assert.equal(is_typing_target({ tagName: "INPUT" }), true);
	assert.equal(is_typing_target({ tagName: "DIV", isContentEditable: true }), true);
	assert.equal(is_typing_target({ tagName: "DIV" }), false);
	assert.equal(is_typing_target(null), false);
});

test("sequences match within the timeout", () => {
	const seq = new Sequences(
		[
			{ keys: ["g", "f"], id: "orgs" },
			{ keys: ["g", "k"], id: "contacts" },
		],
		1000
	);
	const pending = seq.feed("g", 0);
	assert.equal(pending.status, "pending");
	assert.deepEqual(
		pending.options.map((o) => o.id),
		["orgs", "contacts"]
	);
	assert.equal(seq.feed("f", 500).binding.id, "orgs");
	assert.equal(seq.prefix, null);
});

test("sequences expire and restart", () => {
	const seq = new Sequences([{ keys: ["g", "f"] }], 1000);
	seq.feed("g", 0);
	assert.equal(seq.feed("f", 1500).status, "none");
	seq.feed("g", 2000);
	assert.equal(seq.feed("x", 2100).status, "none");
	assert.equal(seq.feed("x", 2200).status, "none");
	assert.equal(seq.feed("g", 3000).status, "pending");
});

test("score orders exact, prefix, word, substring, fuzzy", () => {
	const s = (t) => score("deal", t);
	assert.ok(s("Deal") > s("Deals"));
	assert.ok(s("Deals") > s("Neuer Deal"));
	assert.ok(s("Neuer Deal") > s("Ideal"));
	assert.ok(s("Ideal") > s("D-e-a-l"));
	assert.equal(score("xyz", "Deal"), 0);
	assert.equal(score("", "anything"), 1);
});

test("rank filters, sorts stably and limits", () => {
	const items = ["Meetings", "Meeting anlegen", "Firmen", "Termine"];
	assert.deepEqual(
		rank("mee", items, (x) => x),
		["Meetings", "Meeting anlegen"]
	);
	assert.deepEqual(
		rank("", items, (x) => x, 2),
		["Meetings", "Meeting anlegen"]
	);
	assert.deepEqual(
		rank("mt anl", items, (x) => x),
		["Meeting anlegen"]
	);
});

test("step clamps and starts at the ends", () => {
	assert.equal(step(-1, 3, 1), 0);
	assert.equal(step(-1, 3, -1), 2);
	assert.equal(step(2, 3, 1), 2);
	assert.equal(step(0, 3, -1), 0);
	assert.equal(step(0, 0, 1), -1);
});

test("recent_refs returns newest distinct forms of known doctypes", () => {
	const history = [
		["Form", "Organization", "ORG-1"],
		["List", "Organization"],
		["Form", "Note", "N-1"],
		["Form", "Deal", "new-deal-1"],
		["Form", "Contact", "C-1"],
		["Form", "Organization", "ORG-1"],
	];
	assert.deepEqual(recent_refs(history, ["Organization", "Contact", "Deal"]), [
		["Organization", "ORG-1"],
		["Contact", "C-1"],
	]);
});

test("non-text inputs are not typing targets", () => {
	for (const type of ["checkbox", "radio", "button", "submit", "range", "reset"]) {
		assert.equal(is_typing_target({ tagName: "INPUT", type }), false, type);
	}
	assert.equal(is_typing_target({ tagName: "INPUT", type: "text" }), true);
	assert.equal(is_typing_target({ tagName: "INPUT", type: "SEARCH" }), true);
});

test("a new query drops stale records at once and ignores late answers", () => {
	const state = new PaletteState();
	const first = state.set_query("acme");
	assert.equal(state.accept_records(first, { Organization: ["old"] }), true);
	const second = state.set_query("acme gm");
	assert.deepEqual(state.records, {});
	assert.equal(state.accept_records(first, { Organization: ["stale"] }), false);
	assert.deepEqual(state.records, {});
	assert.equal(state.accept_records(second, { Organization: ["new"] }), true);
	assert.deepEqual(state.records, { Organization: ["new"] });
});

test("typing never cancels the recent request", () => {
	const state = new PaletteState();
	const recent = state.begin_recent();
	state.set_query("a");
	state.set_query("ab");
	assert.equal(state.accept_recent(recent, ["r1"]), true);
	assert.deepEqual(state.recent, ["r1"]);
	state.set_query("");
	assert.deepEqual(state.recent, ["r1"]);
});

test("closing invalidates every pending answer", () => {
	const state = new PaletteState();
	const recent = state.begin_recent();
	const query = state.set_query("x");
	state.close();
	assert.equal(state.accept_recent(recent, ["r"]), false);
	assert.equal(state.accept_records(query, { Deal: [] }), false);
});

test("visible applies the score threshold to every list", () => {
	const items = [{ label: "Demo Robotics Ltd" }, { label: "Dana Doe" }];
	const label = (i) => i.label;
	assert.deepEqual(visible("", items, label, 50, 5), items);
	assert.deepEqual(visible("demo", items, label, 50, 5), [items[0]]);
	assert.deepEqual(visible("dmo", items, label, 100, 5), []);
	assert.deepEqual(visible("d", items, label, 50, 1), [items[0]]);
});

test("search_action moves with arrows and enters the result list", () => {
	assert.equal(search_action(key("ArrowDown"), false, true), "down");
	assert.equal(search_action(key("ArrowUp"), true, false), "up");
	assert.equal(search_action(key("ArrowDown", { shiftKey: true }), false, true), null);
	assert.equal(search_action(key("Tab"), false, true), "list");
	assert.equal(search_action(key("Tab", { shiftKey: true }), false, true), null);
	assert.equal(search_action(key("Tab", { shiftKey: true }), true, true), "input");
});

test("search_action uses Ctrl J/K/N/P on Mac only", () => {
	for (const [k, action] of [
		["j", "next"],
		["n", "next"],
		["k", "prev"],
		["p", "prev"],
	]) {
		assert.equal(search_action(key(k, { ctrlKey: true }), false, true), action, k);
		assert.equal(search_action(key(k, { ctrlKey: true }), false, false), null, k);
	}
	assert.equal(search_action(key("K", { ctrlKey: true }), true, true), "prev");
	assert.equal(search_action(key("k", { ctrlKey: true, shiftKey: true }), false, true), null);
	assert.equal(search_action(key("k", { metaKey: true }), false, true), null);
	assert.equal(search_action(key("g", { ctrlKey: true }), false, true), null);
});

test("search_action leaves plain keys to the input", () => {
	for (const k of ["j", "k", "Enter", "Escape", "a", "Backspace"]) {
		assert.equal(search_action(key(k), false, true), null, k);
	}
	assert.equal(search_action({ ...key("ArrowDown"), isComposing: true }, false, true), null);
});

test("search_action in the result list: J/K move, Enter opens, others return", () => {
	assert.equal(search_action(key("j"), true, true), "down");
	assert.equal(search_action(key("k"), true, true), "up");
	assert.equal(search_action(key("J", { shiftKey: true }), true, true), "type");
	assert.equal(search_action(key("Enter"), true, true), "open");
	assert.equal(search_action(key("Escape"), true, true), "input");
	assert.equal(search_action(key("a"), true, true), "type");
	assert.equal(search_action(key("1"), true, true), "type");
	assert.equal(search_action(key("Backspace"), true, true), "type");
	assert.equal(search_action(key("Shift", { shiftKey: true }), true, true), null);
});

test("create sequences resolve the added letters", () => {
	const letters = ["m", "d", "k", "f", "e", "s", "a", "t", "p", "j"];
	const seq = new Sequences(letters.map((l) => ({ keys: ["c", l], id: l })));
	for (const l of letters) {
		assert.equal(seq.feed("c", 0).status, "pending");
		assert.equal(seq.feed(l, 10).binding.id, l);
	}
});

test("search_list_mode enters on arrows and Tab, leaves on typing, Esc and open", () => {
	for (const action of ["down", "up", "list"])
		assert.equal(search_list_mode(action, false), true);
	for (const action of ["input", "type", "open"])
		assert.equal(search_list_mode(action, true), false);
	assert.equal(search_list_mode("next", false), false);
	assert.equal(search_list_mode("prev", true), true);
});

test("chip_index maps Cmd or Ctrl + 1..9 to filter chips, layout-independent", () => {
	const ev = (extra) => ({ altKey: false, metaKey: false, ctrlKey: false, shiftKey: false, ...extra });
	assert.equal(chip_index(ev({ key: "1", code: "Digit1", metaKey: true })), 0);
	assert.equal(chip_index(ev({ key: "9", code: "Digit9", ctrlKey: true })), 8);
	assert.equal(chip_index(ev({ key: "!", code: "Digit1", metaKey: true, shiftKey: true })), 0);
	assert.equal(chip_index(ev({ key: "3", code: "Numpad3", ctrlKey: true })), 2);
	assert.equal(chip_index(ev({ key: "0", code: "Digit0", metaKey: true })), -1);
	assert.equal(chip_index(ev({ key: "1", code: "Digit1" })), -1);
	assert.equal(chip_index(ev({ key: "1", code: "Digit1", metaKey: true, altKey: true })), -1);
	assert.equal(chip_index(null), -1);
});
