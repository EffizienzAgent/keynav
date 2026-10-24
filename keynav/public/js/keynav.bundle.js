import { add, registry, route_url } from "./keynav/commands";
import { copy_markdown_link } from "./keynav/copy_link";
import { key_label, keys_html } from "./keynav/labels";
import { GROUP_LABELS, palette, show_shortcuts } from "./keynav/shortcuts";

window.keynav = {
	add,
	remove: (...ids) => registry.remove(...ids),
	clear: (group) => registry.clear(group),
	set_group_label: (group, label) => {
		GROUP_LABELS[group] = label;
	},
	open_palette: () => palette.is_open() || palette.open(),
	show_shortcuts,
	copy_markdown_link,
	route_url,
	key_label,
	keys_html,
};
