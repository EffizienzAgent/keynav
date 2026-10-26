import sys

import frappe
from frappe.desk.doctype.global_search_settings.global_search_settings import update_global_search_doctypes
from frappe.utils.global_search import sync_global_search

NOTES = [
	"Q3 Roadmap Review",
	"Onboarding Checklist for New Hires",
	"Quarterly Planning Notes",
	"Customer Feedback: Acme Corp",
	"Release Notes 0.2",
	"Support Escalation Process",
	"Pricing Workshop Summary",
]

TODOS = [
	"Prepare quarterly report",
	"Review pull request for search ranking",
	"Call Acme Corp about renewal",
	"Update onboarding documentation",
	"Plan team offsite",
	"Clean up old file attachments",
	"Send invoice reminders",
	"Draft Q4 roadmap",
]

USERS = [
	("Quinn", "Baker"),
	("Alex", "Morgan"),
	("Sam", "Rivera"),
	("Jordan", "Lee"),
]


def complete_setup():
	frappe.db.set_value("Installed Application", {"app_name": "frappe"}, "is_setup_complete", 1)
	frappe.db.set_default("desktop:home_page", "workspace")
	update_global_search_doctypes()
	frappe.db.commit()


def run():
	complete_setup()
	if frappe.db.exists("Note", {"title": NOTES[0]}):
		print("Demo data already present")
		return

	for title in NOTES:
		frappe.get_doc({"doctype": "Note", "title": title, "public": 1, "content": f"<p>{title}</p>"}).insert()

	for i, description in enumerate(TODOS):
		frappe.get_doc(
			{
				"doctype": "ToDo",
				"description": description,
				"priority": ["High", "Medium", "Low"][i % 3],
				"date": frappe.utils.add_days(frappe.utils.today(), i),
			}
		).insert()

	for first, last in USERS:
		frappe.get_doc(
			{
				"doctype": "User",
				"email": f"{first.lower()}@example.com",
				"first_name": first,
				"last_name": last,
				"send_welcome_email": 0,
			}
		).insert()

	sync_global_search()
	frappe.db.commit()
	print("Demo data created")


if __name__ == "__main__":
	frappe.init(site=sys.argv[1], sites_path=".")
	frappe.connect()
	try:
		run()
	finally:
		frappe.destroy()
