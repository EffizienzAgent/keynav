import frappe
from frappe import _

LIMIT = 5
CANDIDATES = 20
MAX_RECENT = 10
RATE_LIMIT = 60
RATE_WINDOW = 10

DEFAULT_SOURCES = {
	"Note": {"title": "title", "label": "Notes", "detail": "modified", "date": True},
	"User": {
		"title": "full_name",
		"search": ("email",),
		"detail": "email",
		"label": "Users",
		"filters": {"enabled": 1},
	},
}


def get_sources() -> dict:
	sources = dict(DEFAULT_SOURCES)
	for path in frappe.get_hooks("keynav_search_sources"):
		sources = frappe.get_attr(path)(sources)
	return sources


def boot(bootinfo):
	bootinfo.keynav = {
		"sources": [
			{"doctype": doctype, "label": source.get("label", doctype), "date": bool(source.get("date"))}
			for doctype, source in get_sources().items()
			if readable(doctype)
		]
	}


def rank(query: str, title: str) -> int:
	query, title = query.lower(), (title or "").lower()
	if title == query:
		return 0
	if title.startswith(query):
		return 1
	if any(word.startswith(query) for word in title.split()):
		return 2
	return 3 if query in title else 4


def title_field(source):
	return source.get("title", "name")


def rows(doctype, source, filters=None, or_filters=None, limit=LIMIT):
	fields = ["name", f"{title_field(source)} as title"]
	if source.get("detail"):
		fields.append(f"{source['detail']} as detail")
	fields.extend(source.get("fields", ()))
	return frappe.get_list(
		doctype,
		fields=fields,
		filters=filters,
		or_filters=or_filters,
		order_by="modified desc",
		limit=limit,
	)


def as_result(doctype, row, source=None):
	detail = row.get("detail")
	if detail is not None and not isinstance(detail, str):
		detail = str(detail)
	result = {"doctype": doctype, "name": row.name, "title": row.title or row.name, "detail": detail}
	if source and source.get("format"):
		result.update(frappe.get_attr(source["format"])(row))
	return result


def readable(doctype):
	return frappe.has_permission(doctype, "read")


def escape_like(text: str) -> str:
	return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_doctype(doctype, query, sources=None):
	source = (sources or get_sources())[doctype]
	if source.get("search_function"):
		return frappe.get_attr(source["search_function"])(doctype, query, source)[:LIMIT]
	title, base = title_field(source), source.get("filters", {})
	pattern = escape_like(query)
	fields = dict.fromkeys(("name", title, *source.get("search", ())))
	found = {}
	for filters, or_filters in (
		({title: query}, None),
		({title: ["like", f"{pattern}%"]}, None),
		({}, [[f, "like", f"%{pattern}%"] for f in fields]),
	):
		for row in rows(doctype, source, {**base, **filters}, or_filters, CANDIDATES):
			found.setdefault(row.name, row)
	ranked = sorted(found.values(), key=lambda row: rank(query, row.title or row.name))
	return [as_result(doctype, row, source) for row in ranked[:LIMIT]]


def parse_refs(recent):
	try:
		refs = frappe.parse_json(recent)
	except ValueError:
		return []
	return refs if isinstance(refs, list) else []


def resolve_recent(recent, sources):
	refs = [
		(r[0], r[1])
		for r in parse_refs(recent)[:MAX_RECENT]
		if isinstance(r, list | tuple) and len(r) == 2 and all(isinstance(x, str) for x in r) and r[0] in sources
	]
	by_doctype = {}
	for doctype, name in refs:
		by_doctype.setdefault(doctype, []).append(name)
	found = {}
	for doctype, names in by_doctype.items():
		if not readable(doctype):
			continue
		for row in rows(doctype, sources[doctype], filters={"name": ["in", names]}, limit=len(names)):
			found[(doctype, row.name)] = as_result(doctype, row, sources[doctype])
	return [found[ref] for ref in refs if ref in found]


def check_rate_limit():
	if not frappe.request:
		return
	key = frappe.cache.make_key(f"keynav:search:{frappe.session.user}")
	count = frappe.cache.incrby(key, 1)
	if count == 1:
		frappe.cache.expire(key, RATE_WINDOW)
	if count > RATE_LIMIT:
		frappe.throw(_("Too many searches. Please wait a few seconds."), frappe.RateLimitExceededError)


@frappe.whitelist()
def search(query: str = "", recent=None) -> dict:
	check_rate_limit()
	query = (query or "").strip()[:100]
	sources = get_sources()
	groups = {}
	if query:
		for doctype in sources:
			if readable(doctype):
				matches = search_doctype(doctype, query, sources)
				if matches:
					groups[doctype] = matches
	return {"groups": groups, "recent": resolve_recent(recent, sources) if recent else []}
