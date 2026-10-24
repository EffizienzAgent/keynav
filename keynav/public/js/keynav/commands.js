import { copy_link_key, copy_markdown_link } from "./copy_link.js";
import { Registry } from "./registry.js";

export const registry = new Registry();

export const DEFAULT_COMMANDS = [
	{ keys: ["g", "t"], label: "ToDo", group: "navigate", route: ["List", "ToDo"] },
	{ keys: ["g", "n"], label: "Notes", group: "navigate", route: ["List", "Note"] },
	{ keys: ["g", "f"], label: "Files", group: "navigate", route: ["List", "File"] },
	{ keys: ["g", "r"], label: "Reports", group: "navigate", route: ["List", "Report"] },
	{ keys: ["g", "u"], label: "Users", group: "navigate", route: ["List", "User"] },
	{
		keys: ["g", "s"],
		label: "System Settings",
		group: "navigate",
		route: ["Form", "System Settings"],
	},
	{ keys: ["c", "t"], label: "New ToDo", group: "create", doctype: "ToDo" },
	{ keys: ["c", "n"], label: "New Note", group: "create", doctype: "Note" },
	{ keys: ["c", "u"], label: "New User", group: "create", doctype: "User" },
	{
		id: "copy-link",
		group: "help",
		label: "Copy link as Markdown",
		keys: () => (copy_link_key() ? [copy_link_key()] : undefined),
		run: () => copy_markdown_link(),
	},
	{
		id: "shortcuts",
		group: "help",
		keys: ["?"],
		label: "Keyboard Shortcuts",
		run: () => frappe.ui.keys.show_keyboard_shortcut_dialog(),
	},
];

export function route_url(route, filters) {
	const url = frappe.router.make_url(frappe.router.convert_from_standard_route(route));
	if (!filters) return url;
	return `${url}?${new URLSearchParams(filters)}`;
}

export function command_id(spec) {
	if (spec.id) return spec.id;
	if (spec.route) return `go:${spec.route.join("/")}`;
	if (spec.doctype) return `new:${spec.doctype}`;
	return spec.label;
}

export function normalize(spec) {
	const keys = typeof spec.keys === "function" ? spec.keys() : spec.keys;
	const command = { ...spec, id: command_id(spec), keys, label: __(spec.label) };
	if (spec.route && !spec.run) {
		const args = spec.filters ? [...spec.route, spec.filters] : spec.route;
		command.run = () => frappe.set_route(...args);
	}
	if (spec.route && !spec.url) command.url = () => route_url(spec.route, spec.filters);
	if (spec.doctype && !spec.run) command.run = () => frappe.new_doc(spec.doctype);
	return command;
}

function with_ids(specs) {
	return [].concat(specs).map((s) => (typeof s === "function" ? s : { ...s, id: command_id(s) }));
}

export function add(specs, options) {
	registry.add(with_ids(specs), options);
}

export function palette_commands() {
	return registry.commands().map(normalize);
}

export function sequence_commands() {
	return palette_commands().filter((c) => c.keys?.length === 2);
}

add(DEFAULT_COMMANDS);
