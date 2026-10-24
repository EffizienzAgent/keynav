from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from keynav import api


def make_user(email, roles=()):
	if frappe.db.exists("User", email):
		return email
	user = frappe.get_doc({"doctype": "User", "email": email, "first_name": email.split("@")[0]})
	user.insert(ignore_permissions=True)
	user.add_roles(*roles)
	return email


def make_note(title, public=1):
	return frappe.get_doc({"doctype": "Note", "title": title, "public": public}).insert()


def names(result, doctype):
	return [r["name"] for r in result["groups"].get(doctype, [])]


def only_notes(sources):
	return {"Note": {**sources["Note"], "label": "Pages"}}


class TestSearch(IntegrationTestCase):
	def setUp(self):
		self.addCleanup(frappe.set_user, "Administrator")
		self.alice = make_user("keynav-alice@example.com", ["Desk User"])
		self.bob = make_user("keynav-bob@example.com", ["Desk User"])

	def test_rank_prefers_exact_then_prefix_then_word(self):
		titles = ["The Widget", "xwidgetx", "Widget Ltd", "Widget"]
		self.assertEqual(
			sorted(titles, key=lambda t: api.rank("widget", t)),
			["Widget", "Widget Ltd", "The Widget", "xwidgetx"],
		)

	def test_finds_note_by_title(self):
		token = frappe.generate_hash(length=10)
		note = make_note(f"{token} roadmap")
		[row] = api.search(token)["groups"]["Note"]
		self.assertEqual(row["name"], note.name)
		self.assertEqual(set(row), {"doctype", "name", "title", "detail"})

	def test_empty_query_searches_nothing(self):
		self.assertEqual(api.search("")["groups"], {})

	def test_limits_matches_per_doctype(self):
		token = frappe.generate_hash(length=10)
		for i in range(7):
			make_note(f"{token} {i}")
		self.assertEqual(len(api.search(token)["groups"]["Note"]), api.LIMIT)

	def test_private_note_of_another_user_is_hidden(self):
		token = frappe.generate_hash(length=10)
		with self.set_user(self.alice):
			private = make_note(f"{token} private", public=0)
		with self.set_user(self.bob):
			self.assertEqual(names(api.search(token), "Note"), [])
			recent = api.search("", frappe.as_json([["Note", private.name]]))
			self.assertEqual(recent["recent"], [])
		with self.set_user(self.alice):
			self.assertEqual(names(api.search(token), "Note"), [private.name])

	def test_recent_keeps_order_and_skips_unknown(self):
		first, second = make_note("first"), make_note("second")
		recent = [["Note", second.name], ["Note", "missing"], ["Unknown", "x"], ["Note", first.name]]
		result = api.search("", frappe.as_json(recent))
		self.assertEqual([r["name"] for r in result["recent"]], [second.name, first.name])

	def test_like_wildcards_are_literal(self):
		token = frappe.generate_hash(length=10)
		percent = make_note(f"{token} 100% off")
		make_note(f"{token} 100x off")
		self.assertEqual(names(api.search(f"{token} 100%"), "Note"), [percent.name])

	def test_hook_replaces_sources(self):
		token = frappe.generate_hash(length=10)
		make_note(token)
		get_hooks = frappe.get_hooks

		def hooks(name, *args, **kwargs):
			if name == "keynav_search_sources":
				return ["keynav.tests.test_api.only_notes"]
			return get_hooks(name, *args, **kwargs)

		with patch("frappe.get_hooks", side_effect=hooks):
			self.assertEqual(list(api.get_sources()), ["Note"])
			self.assertEqual(list(api.search(token)["groups"]), ["Note"])
			bootinfo = frappe._dict()
			api.boot(bootinfo)
		self.assertEqual(
			bootinfo.keynav["sources"], [{"doctype": "Note", "label": "Pages", "date": True}]
		)
