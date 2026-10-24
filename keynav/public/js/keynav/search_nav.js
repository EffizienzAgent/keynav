import { chip_index, search_action, search_list_mode, SEARCH_MOVES, step } from "./core";

const LIST_MODE = "keynav-search-list-mode";
const GLOBAL_RESULTS = "a.global-search-name-link:visible, a.result-section-link:visible";
const FILTER_CHIPS = [".global-search-filter-pill", ".global-search-more-trigger"]
	.map((chip) => `.global-search-visible-pills ${chip}:visible`)
	.join(", ");

function consume(e) {
	e.preventDefault();
	e.stopImmediatePropagation();
}

function awesomebar_key(e, input) {
	const awesomplete = input.awesomplete;
	const container = input.closest(".awesomplete");
	if (!awesomplete || !container) return;
	const in_list = container.classList.contains(LIST_MODE);
	const action = search_action(e, in_list, frappe.utils.is_mac());
	if (!action) return;
	const has_results = awesomplete.opened && awesomplete.ul.children.length > 0;
	container.classList.toggle(LIST_MODE, search_list_mode(action, in_list) && has_results);
	if (action === "type" || action === "open") return;
	if (!has_results) {
		if (action === "next" || action === "prev") consume(e);
		return;
	}
	consume(e);
	if (SEARCH_MOVES[action]) awesomplete[SEARCH_MOVES[action] > 0 ? "next" : "previous"]();
}

function global_search_key(e, dialog) {
	const input = dialog.querySelector(".search-input");
	const links = $(dialog).find(".modal-body").find(GLOBAL_RESULTS).toArray();
	const index = links.indexOf(document.activeElement);
	if (!input || (index === -1 && document.activeElement !== input)) return;
	const action = search_action(e, index !== -1, frappe.utils.is_mac());
	if (!action || action === "open") return;
	if (action === "type") {
		input.focus();
		return;
	}
	if (action === "input") {
		consume(e);
		input.focus();
		return;
	}
	if (!links.length) {
		if (action === "next" || action === "prev") consume(e);
		return;
	}
	if (action === "list" && index !== -1) return;
	consume(e);
	const next = action === "list" ? 0 : step(index, links.length, SEARCH_MOVES[action]);
	focus_result(links[next]);
}

function focus_result(link) {
	// Safari only focuses links that carry a tabindex.
	if (!link.hasAttribute("tabindex")) link.setAttribute("tabindex", "-1");
	link.focus();
	link.scrollIntoView({ block: "nearest" });
}

function filter_chip_key(e) {
	const index = chip_index(e);
	const dialog = document.querySelector(".search-dialog.show");
	if (index === -1 || !dialog) return false;
	consume(e);
	const chip = $(dialog).find(FILTER_CHIPS).get(index);
	if (chip) {
		chip.click();
		dialog.querySelector(".search-input")?.focus({ preventScroll: true });
	}
	return true;
}

function on_keydown(e) {
	if (e.defaultPrevented || filter_chip_key(e)) return;
	const active = document.activeElement;
	if (active?.id === "navbar-search") {
		awesomebar_key(e, active);
		return;
	}
	if (active === document.body) {
		const input = document.querySelector(".search-dialog.show .search-input");
		if (input) input.focus();
	}
	const dialog = document.activeElement?.closest?.(".search-dialog.show");
	if (dialog) global_search_key(e, dialog);
}

function on_awesomplete_close(e) {
	e.target.closest?.(".awesomplete")?.classList.remove(LIST_MODE);
}

document.documentElement.classList.toggle("keynav-mac", frappe.utils.is_mac());
window.addEventListener("keydown", on_keydown, true);
document.addEventListener("awesomplete-close", on_awesomplete_close);
