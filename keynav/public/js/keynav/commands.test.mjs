import test from "node:test";
import assert from "node:assert/strict";

const routes = [];
globalThis.__ = (text, args) => (args ? `${text}|${args.join(",")}` : `t:${text}`);
globalThis.frappe = {
	set_route: (...args) => routes.push(args),
	new_doc: (doctype) => routes.push(["new", doctype]),
	router: { make_url: (r) => `/desk/${r.join("/")}`, convert_from_standard_route: (r) => r },
	utils: { is_mac: () => true },
};
const { add, DEFAULT_COMMANDS, normalize, palette_commands, registry, sequence_commands } =
	await import("./commands.js");

test("default sequence keys are unique", () => {
	const keys = DEFAULT_COMMANDS.filter((c) => Array.isArray(c.keys)).map((c) => c.keys.join(" "));
	assert.equal(new Set(keys).size, keys.length);
});

test("route commands get an id, a route and a url", () => {
	const command = normalize({ label: "Deals", route: ["List", "Deal"], filters: { stage: "Won" } });
	assert.equal(command.id, "go:List/Deal");
	assert.equal(command.label, "t:Deals");
	assert.equal(command.url(), "/desk/List/Deal?stage=Won");
	command.run();
	assert.deepEqual(routes.pop(), ["List", "Deal", { stage: "Won" }]);
});

test("doctype commands create a new document unless they bring their own run", () => {
	normalize({ label: "New Deal", doctype: "Deal" }).run();
	assert.deepEqual(routes.pop(), ["new", "Deal"]);
	let ran = false;
	normalize({ label: "New Deal", doctype: "Deal", run: () => (ran = true) }).run();
	assert.equal(ran, true);
	assert.equal(normalize({ label: "x", doctype: "Deal" }).id, "new:Deal");
});

test("host apps replace the defaults and keep the help commands", () => {
	registry.clear("navigate");
	registry.clear("create");
	add([{ keys: ["g", "o"], label: "Orders", group: "navigate", route: ["List", "Order"] }]);
	add({ id: "news", group: "help", label: "What's New", run() {} }, { before: "shortcuts" });
	assert.deepEqual(
		palette_commands().map((c) => c.id),
		["go:List/Order", "copy-link", "news", "shortcuts"]
	);
	assert.deepEqual(
		sequence_commands().map((c) => c.keys.join(" ")),
		["g o"]
	);
	assert.deepEqual(palette_commands()[1].keys, ["mod+shift+c"]);
});
