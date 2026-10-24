import test from "node:test";
import assert from "node:assert/strict";
import { Registry } from "./registry.js";

const ids = (registry) => registry.commands().map((c) => c.id);

test("commands are sorted by group and keep insertion order inside a group", () => {
	const registry = new Registry();
	registry.add([
		{ id: "help", group: "help" },
		{ id: "custom", group: "crm" },
		{ id: "new", group: "create" },
		{ id: "go-1", group: "navigate" },
		{ id: "go-2", group: "navigate" },
	]);
	registry.add(() => [{ id: "here", group: "context" }]);
	assert.deepEqual(ids(registry), ["here", "go-1", "go-2", "new", "custom", "help"]);
});

test("add replaces a command with the same id and can insert before another", () => {
	const registry = new Registry();
	registry.add([{ id: "a", label: "A" }, { id: "c" }]);
	registry.add({ id: "b" }, { before: "c" });
	registry.add({ id: "a", label: "Other" });
	assert.deepEqual(ids(registry), ["a", "b", "c"]);
	assert.equal(registry.commands()[0].label, "Other");
});

test("remove and clear leave providers alone", () => {
	const registry = new Registry();
	registry.add([{ id: "a", group: "navigate" }, { id: "b", group: "create" }, { id: "c", group: "create" }]);
	registry.add(() => [{ id: "p", group: "context" }]);
	registry.remove("a");
	assert.deepEqual(ids(registry), ["p", "b", "c"]);
	registry.clear("create");
	assert.deepEqual(ids(registry), ["p"]);
	registry.clear();
	assert.deepEqual(ids(registry), []);
});

test("providers run on every read", () => {
	const registry = new Registry();
	let count = 0;
	registry.add(() => [{ id: `p${++count}` }]);
	assert.deepEqual(ids(registry), ["p1"]);
	assert.deepEqual(ids(registry), ["p2"]);
});
