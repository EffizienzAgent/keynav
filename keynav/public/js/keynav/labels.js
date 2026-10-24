const MAC_NAMES = { mod: "⌘", ctrl: "⌃", shift: "⇧", enter: "↩", esc: "Esc", tab: "⇥" };
const OTHER_NAMES = {
	mod: "Ctrl",
	ctrl: "Ctrl",
	shift: "Shift",
	enter: "Enter",
	esc: "Esc",
	tab: "Tab",
};

export function key_label(key) {
	const names = frappe.utils.is_mac() ? MAC_NAMES : OTHER_NAMES;
	const parts = key.split("+").map((part) => names[part] || part.toUpperCase());
	return frappe.utils.is_mac() ? parts.join("") : parts.join("+");
}

export function keys_html(keys) {
	return keys
		.map((key) => `<kbd class="keynav-kbd">${frappe.utils.escape_html(key_label(key))}</kbd>`)
		.join("");
}
