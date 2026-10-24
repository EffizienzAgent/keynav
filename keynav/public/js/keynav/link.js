export const COPY_LINK_KEY = "mod+shift+c";

export function escape_link_text(text) {
	return String(text ?? "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[\\[\]]/g, "\\$&");
}

function escape_link_url(url) {
	return String(url).replace(/[\s()<>]/g, (c) =>
		`%${c.charCodeAt(0).toString(16).padStart(2, "0")}`.toUpperCase()
	);
}

export function markdown_link(title, url) {
	return `[${escape_link_text(title)}](${escape_link_url(url)})`;
}

export function canonical_url(location) {
	return `${location.origin}${location.pathname}${location.search}`;
}

export function view_title({
	route,
	doctype_label,
	record_title,
	view_label,
	page_title,
	fallback,
}) {
	const [view, doctype] = route || [];
	if (view === "Form" && doctype && record_title) return `${doctype_label}: ${record_title}`;
	if (view === "List" && doctype) return `${doctype_label} (${view_label})`;
	return page_title || fallback || "";
}
