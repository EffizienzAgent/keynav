const GROUP_ORDER = ["context", "navigate", "create", "", "help"];

function group_rank(group) {
	const index = GROUP_ORDER.indexOf(group || "");
	return index === -1 ? GROUP_ORDER.indexOf("") : index;
}

export class Registry {
	constructor() {
		this.entries = [];
	}

	add(entries, { before } = {}) {
		for (const entry of [].concat(entries)) {
			const existing = this.index_of(entry.id);
			if (existing !== -1) {
				this.entries[existing] = entry;
				continue;
			}
			const anchor = this.index_of(before);
			if (anchor === -1) this.entries.push(entry);
			else this.entries.splice(anchor, 0, entry);
		}
	}

	remove(...ids) {
		this.entries = this.entries.filter((e) => typeof e === "function" || !ids.includes(e.id));
	}

	clear(group) {
		this.entries = group
			? this.entries.filter((e) => typeof e === "function" || e.group !== group)
			: [];
	}

	index_of(id) {
		if (!id) return -1;
		return this.entries.findIndex((e) => typeof e !== "function" && e.id === id);
	}

	commands() {
		return this.entries
			.flatMap((entry) => (typeof entry === "function" ? entry() || [] : [entry]))
			.map((command, index) => ({ command, index }))
			.sort((a, b) => group_rank(a.command.group) - group_rank(b.command.group) || a.index - b.index)
			.map(({ command }) => command);
	}
}
