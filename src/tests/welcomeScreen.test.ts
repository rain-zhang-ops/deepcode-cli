import { test } from "node:test";
import assert from "node:assert/strict";
import { setLocale, t } from "../i18n";
import { buildWelcomeTips, formatHomeRelativePath } from "../ui";

test("formatHomeRelativePath returns tilde for the home directory", () => {
  assert.equal(formatHomeRelativePath("/Users/example", "/Users/example"), "~");
});

test("formatHomeRelativePath shortens paths inside the home directory", () => {
  const expected = process.platform === "win32" ? "~\\dev\\project" : "~/dev/project";
  assert.equal(formatHomeRelativePath("/Users/example/dev/project", "/Users/example"), expected);
});

test("formatHomeRelativePath keeps paths outside the home directory absolute", () => {
  const expected = process.platform === "win32" ? "C:\\tmp\\project" : "/tmp/project";
  assert.equal(formatHomeRelativePath("/tmp/project", "/Users/example"), expected);
});

test("buildWelcomeTips includes built-in slash commands and loaded skills", () => {
  setLocale("en");
  const tips = buildWelcomeTips([
    { name: "loaded", path: "/skills/loaded/SKILL.md", description: "Loaded skill", isLoaded: true },
    { name: "fresh", path: "/skills/fresh/SKILL.md", description: "Fresh skill" }
  ]);

  const labels = tips.map((tip) => tip.label);
  const descriptions = tips.map((tip) => tip.description.toLowerCase());
  assert.ok(labels.includes("/new"));
  assert.ok(labels.includes("/loaded"));
  assert.equal(labels.includes("/fresh"), false);
  assert.ok(labels.includes("rg + jq"));
  assert.equal(
    descriptions.includes(t("welcome_tip_rg_jq").toLowerCase())
      || descriptions.includes(t("welcome_tip_rg_jq_ready").toLowerCase()),
    true
  );
});
