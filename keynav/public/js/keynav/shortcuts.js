import { chord, is_typing_target, PALETTE_KEY, Sequences, SEQUENCE_TIMEOUT, step } from "./core";
import { sequence_commands } from "./commands";
import { copy_link_key, copy_markdown_link } from "./copy_link";
import { keys_html } from "./labels";
import { Palette } from "./palette";
import "./search_nav";

const LIST_KEYS = new Set(["j", "k", "x", "/"]);
const HIDDEN_FRAPPE_SHORTCUTS = new Set(["ctrl+s", "shift+/"]);

export const palette = new Palette();
const sequences = new Sequences([]);
const list_selection = {};
let hint_timer;

export const GROUP_LABELS = { navigate: "Navigation", create: "Create", context: "Context", help: "Help" };

function commands() {
	if (!sequences.prefix) sequences.bindings = sequence_commands();
	return sequences;
}

function consume(e) {
	e.preventDefault();
	e.stopImmediatePropagation();
}

function dialog_open() {
	return (window.cur_dialog && cur_dialog.display) || $(".modal.show").length > 0;
}

function show_hint(prefix, options) {
	clearTimeout(hint_timer);
	let $hint = $(".keynav-key-hint");
	if (!$hint.length) $hint = $(`<div class="keynav-key-hint" role="status"></div>`).appendTo("body");
	const items = options
		.map((o) => `<span>${keys_html([o.keys[1]])} ${frappe.utils.escape_html(o.label)}</span>`)
		.join("");
	$hint.html(`${keys_html([prefix])}<span class="keynav-key-hint-arrow">→</span>${items}`).show();
	hint_timer = setTimeout(hide_hint, SEQUENCE_TIMEOUT);
}

function hide_hint() {
	clearTimeout(hint_timer);
	$(".keynav-key-hint").hide();
}

function in_comment_editor() {
	return (
		$(document.activeElement).closest(".comment-box, [data-fieldtype='Comment']").length > 0
	);
}

function save_form() {
	if (frappe.get_route()[0] !== "Form" || !window.cur_frm) return false;
	if (dialog_open() || in_comment_editor()) return false;
	frappe.app.trigger_primary_action();
	return true;
}

function current_list() {
	const list = window.cur_list;
	const [view, doctype] = frappe.get_route();
	if (!list || view !== "List" || list.view !== "List" || list.doctype !== doctype) return null;
	return list.$result?.is(":visible") ? list : null;
}

function list_rows(list) {
	return list.$result.find(".list-row-container[tabindex]").has(".list-row-checkbox").toArray();
}

function row_name(row) {
	return row?.querySelector(".list-row-checkbox")?.dataset.name;
}

function selected_index(list, rows) {
	const focused = rows.indexOf(document.activeElement);
	if (focused !== -1) return focused;
	const name = list_selection[list.doctype];
	return name ? rows.findIndex((row) => row_name(row) === name) : -1;
}

function select_row(list, row) {
	if (!row) return;
	row.focus({ preventScroll: true });
	row.scrollIntoView({ block: "nearest" });
	list_selection[list.doctype] = row_name(row);
}

function focus_filter(list) {
	const $form = list.page.page_form;
	const title_field = list.meta?.title_field;
	let $input = title_field
		? $form.find(`.frappe-control[data-fieldname="${title_field}"] input:visible`)
		: $();
	if (!$input.length) $input = $form.find("input:visible").not("[type=checkbox]");
	$input.first().trigger("focus");
}

function handle_list_key(key) {
	const list = current_list();
	if (!list) return false;
	if (key === "/") {
		focus_filter(list);
		return true;
	}
	const rows = list_rows(list);
	if (!rows.length) return true;
	const index = selected_index(list, rows);
	if (key === "x") {
		const row = rows[index];
		if (!row) return true;
		select_row(list, row);
		row.querySelector(".list-row-checkbox").click();
		return true;
	}
	select_row(list, rows[step(index, rows.length, key === "j" ? 1 : -1)]);
	return true;
}

function restore_list_focus(list) {
	const name = list_selection[list.doctype];
	if (!name || document.activeElement !== document.body || current_list() !== list) return;
	const row = list_rows(list).find((r) => row_name(r) === name);
	row?.focus({ preventScroll: true });
}

function patch_list_render() {
	const ListView = frappe.views?.ListView;
	if (!ListView || ListView.prototype.__keynav) return;
	const render = ListView.prototype.render;
	ListView.prototype.render = function (...args) {
		const out = render.apply(this, args);
		restore_list_focus(this);
		return out;
	};
	ListView.prototype.__keynav = true;
}

function on_keydown(e) {
	if (e.defaultPrevented || e.isComposing) return;
	const key = chord(e, frappe.utils.is_mac());
	if (!key) return;

	if (key === PALETTE_KEY) {
		if (!palette.is_open() && dialog_open()) return;
		consume(e);
		hide_hint();
		commands().reset();
		palette.toggle();
		return;
	}
	if (palette.is_open()) return;
	if (key === copy_link_key()) {
		consume(e);
		copy_markdown_link();
		return;
	}
	if (key === "mod+enter") {
		if (save_form()) consume(e);
		return;
	}
	if (key === "esc") {
		commands().reset();
		hide_hint();
		return;
	}
	if (e.repeat || is_typing_target(document.activeElement) || dialog_open()) return;

	const seq = commands();
	if (seq.prefix) {
		const result = seq.feed(key, Date.now());
		if (result.status !== "pending") hide_hint();
		if (result.status === "match") {
			consume(e);
			result.binding.run();
			return;
		}
		if (result.status === "pending") {
			consume(e);
			show_hint(result.prefix, result.options);
			return;
		}
	}
	if (key === "?") {
		consume(e);
		show_shortcuts();
		return;
	}
	if (LIST_KEYS.has(key) && handle_list_key(key)) {
		consume(e);
		return;
	}
	const result = seq.feed(key, Date.now());
	if (result.status === "pending") {
		consume(e);
		show_hint(result.prefix, result.options);
	}
}

function shortcut_rows(rows) {
	return rows
		.map(
			([keys, label]) =>
				`<tr><td width="40%">${keys}</td><td>${frappe.utils.escape_html(label)}</td></tr>`
		)
		.join("");
}

function sequence_html(command) {
	return command.keys
		.map((k) => keys_html([k]))
		.join(` <span class="text-muted">${__("then")}</span> `);
}

function section(heading, rows) {
	return `<h5 class="keynav-shortcuts-heading">${frappe.utils.escape_html(heading)}</h5>
		<table class="table table-bordered keynav-shortcuts">${shortcut_rows(rows)}</table>`;
}

function search_rows() {
	const pair = (a, b) => `${keys_html([a])} / ${keys_html([b])}`;
	const typing = frappe.utils.is_mac()
		? [
				[
					`${pair("ctrl+j", "ctrl+k")} · ${pair("ctrl+n", "ctrl+p")}`,
					__("Move selection while typing"),
				],
		  ]
		: [];
	return [
		[pair("↑", "↓"), __("Move selection")],
		...typing,
		[keys_html(["tab"]), __("Jump into the results")],
		[pair("j", "k"), __("Move selection in the results")],
		[keys_html(["esc"]), __("Back to the search input")],
		[keys_html(["enter"]), __("Run or open")],
		[keys_html(["mod+enter"]), __("Open in new tab (command palette)")],
		[pair("ctrl+1", "ctrl+9"), __("Pick a Global Search filter (1st to 9th)")],
	];
}

function shortcuts_html() {
	const groups = new Map();
	for (const command of sequence_commands()) {
		const group = command.group || "";
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group).push([sequence_html(command), command.label]);
	}
	const sequence_sections = [...groups].map(([group, rows]) =>
		section(__(GROUP_LABELS[group] || group || "Shortcuts"), rows)
	);
	const ours = [
		section(__("Everywhere"), [
			[keys_html([PALETTE_KEY]), __("Open command palette")],
			[keys_html(["?"]), __("Show keyboard shortcuts")],
			[keys_html(["esc"]), __("Close dialog")],
			...(copy_link_key()
				? [[keys_html([copy_link_key()]), __("Copy link as Markdown")]]
				: []),
		]),
		...sequence_sections,
		section(__("Lists"), [
			[`${keys_html(["j"])} / ${keys_html(["k"])}`, __("Select next / previous row")],
			[keys_html(["enter"]), __("Open selected row")],
			[keys_html(["x"]), __("Toggle row checkbox")],
			[keys_html(["/"]), __("Focus list filter")],
		]),
		section(__("Forms"), [
			[`${keys_html(["mod+s"])} / ${keys_html(["mod+enter"])}`, __("Save")],
		]),
		section(__("Search: command palette, Awesomebar, Global Search"), search_rows()),
	];
	const frappe_groups = frappe.ui.keys.get_shortcut_groups().map(({ heading, shortcuts }) =>
		frappe.ui.keys.generate_shortcuts_html(
			shortcuts.filter((s) => !HIDDEN_FRAPPE_SHORTCUTS.has(s.shortcut)),
			heading
		)
	);
	return [...ours, ...frappe_groups].join("");
}

let shortcuts_dialog;

export function show_shortcuts() {
	if (shortcuts_dialog?.display) return;
	shortcuts_dialog = new frappe.ui.Dialog({ title: __("Keyboard Shortcuts"), size: "large" });
	shortcuts_dialog.$body.html(`<div class="keynav-shortcuts-body">${shortcuts_html()}</div>`);
	shortcuts_dialog.show();
}

frappe.ui.keys.show_keyboard_shortcut_dialog = show_shortcuts;
window.addEventListener("keydown", on_keydown, true);
$(document).on("page-change", () => {
	hide_hint();
	patch_list_render();
});
patch_list_render();
