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
	const command = normalize({ label: "Notes", route: ["List", "Note"], filters: { public: 1 } });
	assert.equal(command.id, "go:List/Note");
	assert.equal(command.label, "t:Notes");
	assert.equal(command.url(), "/desk/List/Note?public=1");
	command.run();
	assert.deepEqual(routes.pop(), ["List", "Note", { public: 1 }]);
});

test("doctype commands create a new document unless they bring their own run", () => {
	normalize({ label: "New Note", doctype: "Note" }).run();
	assert.deepEqual(routes.pop(), ["new", "Note"]);
	let ran = false;
	normalize({ label: "New Note", doctype: "Note", run: () => (ran = true) }).run();
	assert.equal(ran, true);
	assert.equal(normalize({ label: "x", doctype: "Note" }).id, "new:Note");
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
