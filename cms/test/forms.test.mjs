// Website forms are GoHighLevel embeds: GoHighLevel stores what visitors send and runs alerts and
// follow-up. The CMS takes no submissions: its submission endpoint, the Super Admin Submissions
// screen and its API are gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testApp, signedIn } from "./helpers.mjs";
import * as R from "../../tools/render.mjs";

test("the website forms are GoHighLevel embeds", () => {
  R.init({ events: [], programs: [], site: {} });
  for (const embed of [R.contactForm(), R.starterKitForm(), R.proposalForm(), R.speakingForm(), R.demoForm(), R.notifyForm(), R.programForm({ title: "X" })]) {
    assert.match(embed, /class="form form--ghl"[^]*<iframe[^>]+src="https:\/\/api\.faithph\.ai\/widget\/form\/[A-Za-z0-9]+"/);
    assert.doesNotMatch(embed, /data-fw-form/, "not sent to the CMS");
  }
});

test("the CMS has no submission endpoint or Submissions API", async () => {
  const { app, cleanup } = testApp({ env: { FORMS_ALLOWED_ORIGINS: "https://example.test" } });
  const post = (path) => app.handle(new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://example.test" }, body: "{}" }));
  assert.equal((await post("/api/forms/submit")).status, 404);
  assert.equal((await post("/api/forms/netlify")).status, 404);
  const u = await signedIn(app);
  assert.equal((await u.super.get("/api/submissions")).status, 404);
  assert.equal((await u.super.get("/api/submissions/sub_x")).status, 404);
  assert.equal((await u.super.put("/api/submissions/sub_x", { status: "completed" })).status, 404);
  const health = await (await app.handle(new Request("http://localhost/api/health"))).json();
  assert.equal("forms" in health, false);
  cleanup();
});

test("the dashboard has no Submissions screen", () => {
  const ui = readFileSync(new URL("../public/ui/app.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /submission/i);
});
