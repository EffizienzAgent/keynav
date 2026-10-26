import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:8010";
const OUT = "docs/screenshots";

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: "light",
	locale: "en-US",
});
await context.addInitScript(() => {
	Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
});
const page = await context.newPage();

await page.request.post(`${BASE_URL}/api/method/login`, {
	form: { usr: "Administrator", pwd: "admin" },
});

async function go(...route) {
	await page.evaluate((r) => frappe.set_route(...r), route);
	await page.waitForFunction((r) => frappe.get_route().join("/") === r.join("/"), route);
	await page.waitForLoadState("networkidle");
}

async function shot(name, options = {}) {
	await page.waitForTimeout(300);
	await page.screenshot({ path: `${OUT}/${name}.png`, ...options });
	console.log(`${OUT}/${name}.png`);
}

async function open_list(doctype) {
	await go("List", doctype, "List");
	await page.locator(".list-row-container").first().waitFor();
	await page.mouse.move(0, 0);
	await page.locator("body").click({ position: { x: 640, y: 880 } });
}

await page.goto(`${BASE_URL}/app/todo`);
await page.waitForFunction(() => window.keynav && frappe.boot);

for (const title of ["Q3 Roadmap Review", "Quarterly Planning Notes", "Pricing Workshop Summary"]) {
	const name = await page.evaluate((t) => frappe.db.get_value("Note", { title: t }, "name"), title);
	await go("Form", "Note", name.message.name);
}

await open_list("ToDo");
await page.keyboard.press("Meta+Period");
await page.locator(".keynav-palette-item").first().waitFor();
await shot("palette");

await page.keyboard.type("or");
await page.waitForFunction(() =>
	[...document.querySelectorAll(".keynav-palette-group")].some((g) => g.textContent === "Users")
);
await shot("palette-search");
await page.keyboard.press("Escape");

await page.keyboard.press("j");
await page.keyboard.press("j");
await page.keyboard.press("x");
await page.keyboard.press("j");
await shot("list-navigation");

await page.keyboard.press("g");
await page.locator(".keynav-key-hint").waitFor();
const hint = await page.locator(".keynav-key-hint").boundingBox();
await shot("sequence-hint", {
	clip: { x: hint.x - 24, y: hint.y - 24, width: hint.width + 48, height: hint.height + 48 },
});
await page.keyboard.press("Escape");

await page.evaluate(() => frappe.searchdialog.search.init_search("plan", "global_search"));
await page.locator(".search-dialog.show a.result-section-link, .search-dialog.show a.global-search-name-link").first().waitFor();
await page.keyboard.press("Tab");
await page.keyboard.press("j");
await shot("global-search");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");

await page.locator("body").click({ position: { x: 640, y: 880 } });
await page.keyboard.press("?");
await page.locator(".keynav-shortcuts-body").waitFor();
await shot("shortcuts");

await browser.close();
