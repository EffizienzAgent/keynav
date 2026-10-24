import test from "node:test";
import assert from "node:assert/strict";
import { canonical_url, escape_link_text, markdown_link, view_title } from "./link.js";

test("markdown_link escapes brackets and backslashes in the title", () => {
	assert.equal(
		markdown_link("Deal: [Q4] a\\b", "https://erp.example.com/app/deal/D-1"),
		"[Deal: \\[Q4\\] a\\\\b](https://erp.example.com/app/deal/D-1)"
	);
});

test("titles collapse whitespace and newlines", () => {
	assert.equal(escape_link_text("  Acme\n Widgets   Ltd. "), "Acme Widgets Ltd.");
	assert.equal(escape_link_text(null), "");
});

test("url parentheses and spaces cannot end the link early", () => {
	assert.equal(markdown_link("x", "https://h/app/a (b)"), "[x](https://h/app/a%20%28b%29)");
});

test("canonical_url drops the hash and keeps filters", () => {
	const location = {
		origin: "https://erp.example.com",
		pathname: "/app/deal/view/kanban/Sales-Pipeline",
		search: "?stage=Won",
		hash: "#details",
	};
	assert.equal(
		canonical_url(location),
		"https://erp.example.com/app/deal/view/kanban/Sales-Pipeline?stage=Won"
	);
});

test("view_title per view type", () => {
	const base = { doctype_label: "Company", view_label: "Kanban", fallback: "Doc" };
	const form = { ...base, route: ["Form", "Customer", "CUST-1"], record_title: "Acme" };
	assert.equal(view_title(form), "Company: Acme");
	assert.equal(view_title({ ...base, route: ["List", "Deal", "Kanban"] }), "Company (Kanban)");
	assert.equal(view_title({ ...base, route: ["reports"], page_title: "Reports" }), "Reports");
	assert.equal(view_title({ ...base, route: ["Workspaces", "Home"] }), "Doc");
	assert.equal(view_title({ ...base, route: ["Form", "Deal", "new-deal-1"] }), "Doc");
});
