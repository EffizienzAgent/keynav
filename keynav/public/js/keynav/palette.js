import {
	chord,
	PaletteState,
	recent_refs,
	search_action,
	search_list_mode,
	SEARCH_MOVES,
	step,
	visible,
} from "./core";
import { palette_commands, route_url } from "./commands";
import { keys_html } from "./labels";

const SEARCH_METHOD = "keynav.api.search";
const DEBOUNCE_MS = 150;
const COMMAND_LIMIT = 6;
const RECENT_LIMIT = 5;
const MIN_SCORE = 50;

function sources() {
	return frappe.boot.keynav?.sources || [];
}

function record_item(record) {
	const route = ["Form", record.doctype, record.name];
	const source = sources().find((s) => s.doctype === record.doctype);
	let detail = record.detail || "";
	if (detail && source?.date) {
		detail = frappe.datetime.str_to_user(detail);
	} else if (detail) {
		detail = __(detail);
	}
	return {
		id: `${record.doctype}:${record.name}`,
		label: record.title,
		detail,
		doctype: record.doctype,
		run: () => frappe.set_route(...route),
		url: () => route_url(route),
	};
}

export class Palette {
	constructor() {
		this.$root = null;
		this.on_focusin = (e) => {
			if (this.is_open() && !this.$root[0].contains(e.target))
				this.close({ restore_focus: false });
		};
	}

	is_open() {
		if (this.$root && !this.$root[0].isConnected) this.close({ restore_focus: false });
		return !!this.$root;
	}

	toggle() {
		this.is_open() ? this.close() : this.open();
	}

	open() {
		this.commands = palette_commands();
		this.state = new PaletteState();
		this.active = 0;
		this.in_list = false;
		this.previous_focus = document.activeElement;
		this.build();
		this.render();
		const [view, doctype, name] = frappe.get_route();
		const current = (ref) => view === "Form" && ref[0] === doctype && ref[1] === name;
		const refs = recent_refs(
			frappe.route_history || [],
			sources().map((s) => s.doctype),
			9
		);
		this.load_recent(refs.filter((ref) => !current(ref)));
	}

	close({ restore_focus = true } = {}) {
		if (!this.$root) return;
		clearTimeout(this.timer);
		this.state.close();
		document.removeEventListener("focusin", this.on_focusin, true);
		const root = this.$root;
		this.$root = null;
		root.remove();
		if (restore_focus && this.previous_focus?.isConnected) this.previous_focus.focus();
	}

	build() {
		this.$root = $(`
			<div class="keynav-palette-backdrop">
				<div class="keynav-palette" role="dialog" aria-modal="true">
					<input class="keynav-palette-input" type="text" autocomplete="off" spellcheck="false"
						role="combobox" aria-expanded="true"
						placeholder="${frappe.utils.escape_html(__("Type a command or search records…"))}">
					<div class="keynav-palette-results" role="listbox"></div>
					<div class="keynav-palette-footer">
						<span>${keys_html(["↑"])}${keys_html(["↓"])} ${__("Move selection")}</span>
						<span>${keys_html(["enter"])} ${__("Run or open")}</span>
						<span>${keys_html(["mod+enter"])} ${__("Open in new tab")}</span>
						<span>${keys_html(["esc"])} ${__("Close palette")}</span>
					</div>
				</div>
			</div>
		`).appendTo(document.body);
		this.$input = this.$root.find(".keynav-palette-input");
		this.$results = this.$root.find(".keynav-palette-results");

		this.$root.on("mousedown", (e) => {
			if (e.target === this.$root[0]) this.close();
		});
		this.$root.on("keydown", (e) => this.on_keydown(e));
		this.$input.on("input", () => this.on_input());
		this.$results.on("mousemove", ".keynav-palette-item", (e) => {
			const index = Number(e.currentTarget.dataset.index);
			if (index !== this.active) this.set_active(index);
		});
		this.$results.on("click", ".keynav-palette-item", (e) => {
			this.run(Number(e.currentTarget.dataset.index), e.metaKey || e.ctrlKey);
		});
		this.$input.trigger("focus");
		document.addEventListener("focusin", this.on_focusin, true);
	}

	on_keydown(e) {
		e.stopPropagation();
		const event = e.originalEvent || e;
		const action = search_action(event, this.in_list, frappe.utils.is_mac());
		if (action) {
			this.set_list_mode(search_list_mode(action, this.in_list) && this.items.length > 0);
			if (action === "type") return;
			e.preventDefault();
			if (action === "open") this.run(this.active, false);
			else if (SEARCH_MOVES[action])
				this.set_active(step(this.active, this.items.length, SEARCH_MOVES[action]));
			return;
		}
		if (e.key === "Tab") {
			e.preventDefault();
			return;
		}
		const key = chord(event, frappe.utils.is_mac());
		if (key === "esc") {
			e.preventDefault();
			this.close();
		} else if (key === "enter" || key === "mod+enter") {
			e.preventDefault();
			if (!e.originalEvent?.isComposing) this.run(this.active, key === "mod+enter");
		}
	}

	on_input() {
		const query = this.$input.val().trim();
		const token = this.state.set_query(query);
		this.active = 0;
		this.render();
		clearTimeout(this.timer);
		if (!query) return;
		this.timer = setTimeout(() => {
			frappe
				.xcall(SEARCH_METHOD, { query })
				.then((result) => {
					if (this.state.accept_records(token, result.groups)) this.render();
				})
				.catch(() => {});
		}, DEBOUNCE_MS);
	}

	load_recent(refs) {
		if (!refs.length) return;
		const token = this.state.begin_recent();
		frappe
			.xcall(SEARCH_METHOD, { query: "", recent: JSON.stringify(refs) })
			.then((result) => {
				if (this.state.accept_recent(token, result.recent.map(record_item))) this.render();
			})
			.catch(() => {});
	}

	groups() {
		const { query, records } = this.state;
		const text = (item) => item.label;
		const commands = visible(query, this.commands, text, MIN_SCORE, COMMAND_LIMIT);
		const recent = visible(query, this.state.recent, text, MIN_SCORE, RECENT_LIMIT);
		const groups = [];
		const seen = new Set(recent.map((r) => r.id));
		if (!query) groups.push({ label: __("Recently opened"), items: recent });
		groups.push({ label: __("Commands"), items: commands });
		if (query) {
			groups.push({ label: __("Recently opened"), items: recent });
			for (const source of sources()) {
				const items = (records[source.doctype] || [])
					.map(record_item)
					.filter((item) => !seen.has(item.id));
				groups.push({ label: __(source.label), items });
			}
		}
		return groups.filter((g) => g.items.length);
	}

	render() {
		if (!this.$root) return;
		const groups = this.groups();
		this.items = groups.flatMap((g) => g.items);
		this.active = Math.min(this.active, Math.max(0, this.items.length - 1));
		let index = 0;
		const html = groups
			.map((group) => {
				const rows = group.items
					.map((item) => {
						const i = index++;
						const right = item.keys
							? `<span class="keynav-palette-keys">${keys_html(item.keys)}</span>`
							: `<span class="keynav-palette-detail">${frappe.utils.escape_html(
									item.detail || ""
							  )}</span>`;
						return `<div class="keynav-palette-item" role="option" data-index="${i}">
							<span class="keynav-palette-label">${frappe.utils.escape_html(item.label)}</span>
							${right}
						</div>`;
					})
					.join("");
				return `<div class="keynav-palette-group">${frappe.utils.escape_html(
					group.label
				)}</div>${rows}`;
			})
			.join("");
		const empty = this.state.query
			? `<div class="keynav-palette-empty">${__("No results")}</div>`
			: "";
		this.$results.html(html || empty);
		this.set_active(this.active);
	}

	set_list_mode(on) {
		this.in_list = on;
		this.$root.find(".keynav-palette").toggleClass("keynav-search-list-mode", on);
	}

	set_active(index) {
		this.active = index;
		const $items = this.$results.find(".keynav-palette-item");
		$items.removeClass("active").attr("aria-selected", "false");
		const $active = $items.eq(index).addClass("active").attr("aria-selected", "true");
		$active[0]?.scrollIntoView({ block: "nearest" });
	}

	run(index, new_tab) {
		const item = this.items?.[index];
		if (!item) return;
		if (new_tab && item.url) {
			window.open(item.url(), "_blank", "noopener");
			return;
		}
		this.close({ restore_focus: false });
		item.run();
	}
}
