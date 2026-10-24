import { canonical_url, COPY_LINK_KEY, markdown_link, view_title } from "./link.js";

export function copy_link_key() {
	return frappe.utils.is_mac() ? COPY_LINK_KEY : null;
}

function record_title(route) {
	const [view, doctype, name] = route;
	const frm = window.cur_frm;
	if (view !== "Form" || !frm || frm.doctype !== doctype || frm.docname !== name) return null;
	if (frm.is_new()) return null;
	return frm.get_title() || frappe.utils.get_link_title(doctype, name) || name;
}

function current_title() {
	const route = frappe.get_route() || [];
	return view_title({
		route,
		doctype_label: route[1] && __(route[1]),
		record_title: record_title(route),
		view_label: __(route[2] || "List"),
		page_title: window.cur_page?.page?.page?.title,
		fallback: document.title,
	});
}

function copied() {
	frappe.show_alert({ message: __("Link copied"), indicator: "green" }, 2);
}

export function copy_markdown_link() {
	const text = markdown_link(current_title(), canonical_url(window.location));
	if (!navigator.clipboard?.writeText) return frappe.utils.copy_to_clipboard(text);
	navigator.clipboard
		.writeText(text)
		.then(copied)
		.catch(() => frappe.utils.copy_to_clipboard(text));
}
