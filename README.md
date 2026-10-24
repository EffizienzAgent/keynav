Keyboard navigation for the Frappe Framework

# Keynav

Keynav adds a command palette, two-key sequences and list navigation to the desk.
It works with Frappe v16 and ships with English and German texts.

## Features

- **Command palette** (`Cmd+.` on Mac, `Ctrl+.` elsewhere): run commands and search records.
  It shows recently opened records first. `Enter` runs or opens, `Cmd/Ctrl+Enter` opens in a new tab.
- **Sequences**: press `g` then a letter to go somewhere, `c` then a letter to create something.
  A hint at the bottom shows the possible second keys.
- **Lists**: `j` / `k` select the next / previous row, `Enter` opens it, `x` toggles its checkbox,
  `/` focuses the list filter.
- **Forms**: `Cmd/Ctrl+Enter` saves.
- **Search**: arrow keys, `Tab`, `j` / `k` and (on Mac) `Ctrl+J/K/N/P` move through the results of
  the palette, the Awesomebar and the Global Search. `Cmd/Ctrl+1` to `9` picks a Global Search filter.
- **Copy link** (`Cmd+Shift+C`, Mac only; elsewhere from the palette): copies the current view as a
  Markdown link `[Title](URL)`.
- `?` shows all shortcuts, including the ones the desk already has.

Default sequences:

| Keys | Action |
| --- | --- |
| `g t` | ToDo |
| `g n` | Notes |
| `g f` | Files |
| `g r` | Reports |
| `g u` | Users |
| `g s` | System Settings |
| `c t` | New ToDo |
| `c n` | New Note |
| `c u` | New User |

The palette searches Notes and Users by default. All searches use the normal permission checks.

## Installation

```bash
bench get-app https://github.com/EffizienzAgent/keynav --branch version-16
bench --site <site> install-app keynav
```

**Compatibility:** Frappe v16. The `version-16` branch always points to the latest release; tagged releases
and the changelog are on the [releases page](https://github.com/EffizienzAgent/keynav/releases).

## Add your own commands

Keynav puts a `keynav` object on `window`. Call it from your app's bundle; Keynav loads before
any app that lists it in `required_apps`.

```js
keynav.add([
	{ keys: ["g", "o"], label: "Orders", group: "navigate", route: ["List", "Sales Order"] },
	{ keys: ["c", "o"], label: "New Order", group: "create", doctype: "Sales Order" },
	{ id: "sync", label: "Sync now", group: "help", run: () => frappe.call("my_app.api.sync") },
]);
```

A command has these fields:

| Field | Meaning |
| --- | --- |
| `label` | Text in the palette and the hint. Keynav translates it with `__()`. |
| `group` | `context`, `navigate`, `create`, `help` or your own name. The palette sorts by group. |
| `keys` | Optional. Two keys make a sequence; one key or chord is only shown in the palette. |
| `route` | Optional. Opens this route; `filters` adds list filters. |
| `doctype` | Optional. Creates a new document of this type. |
| `run` | Optional. Your own action; it wins over `route` and `doctype`. |
| `url` | Optional. Function that returns the URL for "open in new tab". |
| `id` | Optional. Defaults to `go:<route>` or `new:<doctype>`. Adding the same id again replaces it. |

More calls:

```js
keynav.add(() => (cur_frm ? [{ label: __("Email {0}", [cur_frm.docname]), run }] : []));
keynav.add({ id: "news", label: "What's New", group: "help", run }, { before: "shortcuts" });
keynav.clear("navigate");
keynav.clear("create");
keynav.remove("go:List/User");
keynav.set_group_label("crm", __("CRM"));
keynav.open_palette();
```

- A function passed to `add` runs each time the palette opens, so it can return commands for the
  current page.
- `clear(group)` removes the default and added commands of a group, `clear()` removes all.
  Functions stay.
- `before` puts the command in front of another id inside its group.

## Choose what the palette searches

Add a hook to your app's `hooks.py`. Each function gets the current sources and returns new ones:

```python
keynav_search_sources = ["my_app.keynav.search_sources"]
```

```python
def search_sources(sources):
	return {
		**sources,
		"Customer": {
			"title": "customer_name",
			"search": ("email_id",),
			"detail": "territory",
			"label": "Customers",
			"filters": {"disabled": 0},
		},
	}
```

| Key | Meaning |
| --- | --- |
| `title` | Field shown and ranked. Defaults to `name`. |
| `search` | More fields that are searched with `like`. |
| `detail` | Optional field shown on the right. |
| `date` | `True` if `detail` is a date or datetime. |
| `label` | Heading of the result group. |
| `filters` | Filters that always apply. |

Return a dict without the defaults to drop them. The palette shows the groups in the order of the
dict and at most five records per group.

## Development

```bash
node --test 'keynav/**/*.test.mjs'
bench --site your.site run-tests --app keynav
```

## Professional setup & support

Need help setting this up or integrating it into your Frappe stack? Write to oss@effizienzagent.de (English or German). German-speaking SMEs: see [mittelstandshub.de](https://mittelstandshub.de).

## License

MIT
