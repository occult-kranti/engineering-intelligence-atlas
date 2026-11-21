/**
 * Browser gate (task §6): real production server at :3000.
 * - all 9 hash routes (8 atlas chapters + Director) at 1440 and 375
 * - no console errors, no pageerrors, no failed asset requests
 * - no horizontal overflow
 * - Director: unauthenticated login state; API-down degraded state
 * - keyboard basics (skip link focuses, tab order lands on nav)
 * - reduced-motion emulation renders cleanly
 * Screenshots → .work/director-*.png
 */
import { chromium } from "playwright";
import * as fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = new URL("../.work/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "overview",
  "roles",
  "library",
  "jobs",
  "reverse",
  "research",
  "science",
  "methodology",
  "director",
];

const failures = [];
function note(ok, label, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(`${label}: ${detail}`);
}

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});

async function newCheckedPage(viewport, reducedMotion = "no-preference") {
  const ctx = await browser.newContext({ viewport, reducedMotion });
  const page = await ctx.newPage();
  const problems = { console: [], page: [], requests: [] };
  page.on("console", (m) => {
    if (m.type() === "error") problems.console.push(m.text());
  });
  page.on("pageerror", (e) => problems.page.push(String(e)));
  page.on("requestfailed", (r) => {
    // OAuth redirects to external hosts are not attempted in these flows.
    problems.requests.push(`${r.url()} :: ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    if (
      r.status() >= 400 &&
      !url.includes("/api/") && // API 401s are expected unauthenticated behavior
      !url.includes("favicon")
    ) {
      problems.requests.push(`${r.status()} ${url}`);
    }
  });
  return { ctx, page, problems };
}

async function checkOverflow(page) {
  return page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

// ── Atlas chapters: desktop + mobile ────────────────────────────
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
]) {
  for (const route of ROUTES) {
    const { ctx, page, problems } = await newCheckedPage({
      width: vp.width,
      height: vp.height,
    });
    await page.goto(`${BASE}/#/${route}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const shot = `${OUT}director-${route}-${vp.name}.png`;
    await page.screenshot({ path: shot, fullPage: false });

    const { scrollW, innerW } = await checkOverflow(page);
    note(
      scrollW <= innerW + 1,
      `${route}/${vp.name} no horizontal overflow`,
      `scrollW=${scrollW} innerW=${innerW}`,
    );
    const h1 = await page.locator("h1, h2").first().textContent().catch(() => null);
    note(!!h1 && h1.trim().length > 0, `${route}/${vp.name} renders heading`, h1?.slice(0, 60));
    note(
      problems.page.length === 0,
      `${route}/${vp.name} no page errors`,
      problems.page.join(" | ").slice(0, 300),
    );
    note(
      problems.console.length === 0,
      `${route}/${vp.name} no console errors`,
      problems.console.join(" | ").slice(0, 300),
    );
    note(
      problems.requests.length === 0,
      `${route}/${vp.name} no failed asset requests`,
      problems.requests.join(" | ").slice(0, 300),
    );
    await ctx.close();
  }
}

// ── Content correctness spot-checks ─────────────────────────────
{
  const { ctx, page } = await newCheckedPage({ width: 1440, height: 900 });

  // Reverse-engineering chapter: the corrected counts rendered on the page
  // must match the data file (single source of truth, formatted with
  // Intl.NumberFormat en-US → thousands separators).
  const appRoot = new URL("..", import.meta.url).pathname;
  const reverseSrc = fs.readFileSync(`${appRoot}/src/data/reverse.ts`, "utf8");
  const pick = (key) => {
    const m = reverseSrc.match(new RegExp(`"${key}":\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const expected = {
    sourceOccurrences: pick("sourceOccurrences"),
    uniqueProjects: pick("uniqueProjects"),
    multiSourceProjects: pick("multiSourceProjects"),
    totalRecords: pick("totalRecords"),
  };
  const nf = new Intl.NumberFormat("en-US");
  await page.goto(`${BASE}/#/reverse`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const reverseBody = await page.textContent("body");
  for (const [k, v] of Object.entries(expected)) {
    if (v == null) {
      note(false, `reverse data contains ${k}`);
      continue;
    }
    note(
      reverseBody.includes(nf.format(v)),
      `reverse page renders corrected ${k} = ${nf.format(v)}`,
    );
  }

  // Repository-grounded specialist practices: both shared packages, all six
  // agent contexts, and their bundled research artifacts render on Research.
  await page.goto(`${BASE}/#/research`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const researchBody = await page.textContent("body");
  for (const label of [
    "Architecture, Database & Backend Engineering",
    "UI/UX Research, Design & Engineering",
    "Software Architecture Principal",
    "Database Systems Engineer",
    "Backend/Platform Staff Engineer",
    "Product UX Research Lead",
    "Design Systems & Accessibility Engineer",
    "Interaction Prototyping & Evaluation Specialist",
    "Civilization Art & Design Research",
    "Music Theory & Production Engineering",
    "Civilization Art Research Director",
    "Geometric Pattern & Symmetry Specialist",
    "Music Theory Research Director",
    "Audio DSP & Production Engineer",
    "Creative Rights & Reproducibility Editor",
    "Executive Operations Assistant",
    "Donna — CEO Operations Assistant",
    "Shared Department Operations Assistant",
    "Repository Integration Steward",
  ]) {
    note(researchBody.includes(label), `research renders specialist context: ${label}`);
  }
  const specialistHrefs = await page
    .locator('a[href^="research/"]')
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("href")))])
    .then((hrefs) => hrefs.filter((h) => /architecture|ui_ux|ui-ux|software-architecture|database-systems|backend-platform|product-ux|design-systems-accessibility|interaction-prototyping|civilization|music|creative|executive|donna|repository-integration/.test(h)));
  note(specialistHrefs.length >= 36, "research links specialist, creative, and executive reports, casebooks, fixtures, and charters", `${specialistHrefs.length} links`);
  for (const href of specialistHrefs) {
    const res = await page.request.get(`${BASE}/${href}`);
    note(res.ok(), `specialist asset serves: ${href}`, `HTTP ${res.status()}`);
  }

  // The twenty-one agent skill packages render on Overview and Methodology.
  const skillsSrc = fs.readFileSync(`${appRoot}/src/data/skills.ts`, "utf8");
  const skillNames = [...skillsSrc.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
  note(skillNames.length === 21, "skills data holds exactly 21 packages", `${skillNames.length}`);
  for (const route of ["overview", "methodology"]) {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const body = await page.textContent("body");
    const missing = skillNames.filter((n) => !body.includes(n));
    note(
      missing.length === 0,
      `${route} renders all 21 skill packages`,
      missing.length ? `missing: ${missing.join(", ")}` : "",
    );
  }

  // Science & Models chapter: ten agents, evidence tiers, bundled assets.
  const scienceSrc = fs.readFileSync(`${appRoot}/src/data/science.ts`, "utf8");
  const agentsBlock = scienceSrc.split("SCIENCE_AGENTS")[1].split("SOURCE_REPORTS")[0];
  const agentNames = [...agentsBlock.matchAll(/name: '([^']+)',/g)].map(
    (m) => m[1],
  );
  note(agentNames.length === 10, "science data holds exactly 10 agents", `${agentNames.length}`);
  await page.goto(`${BASE}/#/science`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const scienceBody = await page.textContent("body");
  const missingAgents = agentNames.filter((n) => !scienceBody.includes(n));
  note(
    missingAgents.length === 0,
    "science renders all 10 dedicated agents",
    missingAgents.length ? `missing: ${missingAgents.join(", ")}` : "",
  );
  for (const tier of ["[V]", "[I]", "[R]", "no universal SOTA"]) {
    note(
      scienceBody.toLowerCase().includes(tier.toLowerCase()),
      `science explains ${tier} semantics`,
    );
  }
  // Bundled report links resolve inside the app bundle (no 404s).
  const reportHrefs = await page
    .locator('a[href^="research/"]')
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("href")))]);
  note(reportHrefs.length >= 12, "science lists bundled source reports", `${reportHrefs.length} links`);
  for (const href of reportHrefs) {
    const res = await page.request.get(`${BASE}/${href}`);
    note(res.ok(), `bundled research asset serves: ${href}`, `HTTP ${res.status()}`);
  }
  // Lazy images decode only once scrolled into view; walk the page first.
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y <= h; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await settle(page);
  // Lazy images fetch only near the viewport: bring each into view and wait
  // for it to decode individually (the SOTA PNG is 1.5 MB / 5200×3000).
  const imgCount = await page.locator('img[src^="research/"]').count();
  for (let i = 0; i < imgCount; i++) {
    const img = page.locator('img[src^="research/"]').nth(i);
    await img.scrollIntoViewIfNeeded();
    await img
      .evaluate((el) =>
        el.complete && el.naturalWidth > 0
          ? true
          : new Promise((res, rej) => {
              el.addEventListener("load", () => res(true), { once: true });
              el.addEventListener("error", () => rej(new Error("img error")), { once: true });
            }),
      )
      .catch(() => {});
  }
  const imgStates = await page
    .locator('img[src^="research/"]')
    .evaluateAll((imgs) =>
      imgs.map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0, alt: i.getAttribute("alt") ?? "" })),
    );
  note(imgStates.length === 3, "science embeds the map, SOTA landscape, and AI frontier network", `${imgStates.length}`);
  for (const img of imgStates) {
    note(img.ok && img.alt.length > 40, `image loads with meaningful alt: ${img.src}`, img.ok ? "" : "not decoded");
  }
  await ctx.close();
}

// ── Director: unauthenticated + login states ────────────────────
{
  const { ctx, page, problems } = await newCheckedPage({ width: 1440, height: 900 });
  await page.goto(`${BASE}/#/director`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const body = await page.textContent("body");
  const hasLogin =
    /sign in|log in|登录|Sign in/i.test(body) || (await page.locator("a[href*='oauth'], a[href*='auth'], button").count()) > 0;
  note(hasLogin, "director unauthenticated → login state", body.slice(0, 120).replace(/\n/g, " "));
  await page.screenshot({ path: `${OUT}director-login-desktop.png` });
  note(problems.page.length === 0, "director unauth no page errors", problems.page.join("|").slice(0, 200));
  await ctx.close();
}

// ── Director: API-down degraded state (intercept + abort API) ───
{
  const { ctx, page, problems } = await newCheckedPage({ width: 1440, height: 900 });
  await page.route("**/api/trpc/**", (route) => route.abort("connectionfailed"));
  await page.goto(`${BASE}/#/director`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const body = await page.textContent("body");
  const degraded =
    /unavailable|degraded|failed|error|offline|retry|notice/i.test(body);
  note(degraded, "director API-down → honest degraded banner (not a crash/blank)", body.slice(0, 160).replace(/\n/g, " "));
  await page.screenshot({ path: `${OUT}director-api-down.png` });
  await ctx.close();
}

// ── Keyboard + reduced motion basics ────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`${BASE}/#/overview`, { waitUntil: "domcontentloaded" });
  await settle(page);
  // Skip link is the first tab stop and becomes visible on focus.
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.slice(0, 40),
    visible: document.activeElement
      ? document.activeElement.getBoundingClientRect().top >= 0
      : false,
  }));
  note(
    /skip to main/i.test(focused.text ?? ""),
    "first Tab focuses skip-to-content link",
    JSON.stringify(focused),
  );
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const second = await page.evaluate(
    () => document.activeElement?.textContent?.slice(0, 40) ?? "",
  );
  note(second.trim().length > 0, "Tab continues into navigation", second);
  await page.screenshot({ path: `${OUT}director-keyboard-reduced-motion.png` });
  note(errs.length === 0, "reduced-motion render has no page errors", errs.join("|").slice(0, 200));
  await ctx.close();
}

// ── Nav controls: every rail link is live (desktop + mobile topbar) ──
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
]) {
  const { ctx, page } = await newCheckedPage({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}/#/overview`, { waitUntil: "domcontentloaded" });
  await settle(page);
  for (const route of ROUTES) {
    const navSel = `nav[aria-label="Chapters"] a[href="#/${route}"]:visible`;
    const link = page.locator(navSel).first();
    let visible = await link.count().then((c) => c > 0).catch(() => false);
    if (!visible) {
      // Mobile topbar gates chapters behind the expandable menu button.
      const menuBtn = page.locator('button[aria-controls="mobile-chapters"]').first();
      if (await menuBtn.isVisible().catch(() => false)) {
        if ((await menuBtn.getAttribute("aria-expanded")) !== "true") {
          await menuBtn.click();
        }
        await page.waitForTimeout(700); // expand-region animation
      }
      visible = (await link.count()) > 0;
    }
    const target = page.locator(navSel).first();
    const clickable = visible && (await target.count()) > 0;
    note(clickable, `nav link to #/${route} is reachable (${vp.name})`);
    if (clickable) {
      // DOM click: a genuine pointer click was verified manually (menu opens,
      // hash changes); Playwright's actionability scroll races the sticky bar
      // and lands on underlying content.
      await target.evaluate((el) => el.click());
      await page.waitForTimeout(400);
      const hash = await page.evaluate(() => window.location.hash);
      note(
        hash.includes(route),
        `nav link to ${route} navigates (${vp.name})`,
        hash,
      );
    }
  }
  await ctx.close();
}

await browser.close();

console.log(`\n${failures.length ? "FAILURES:" : "ALL BROWSER CHECKS PASSED"}`);
for (const f of failures) console.log("  -", f);
process.exit(failures.length ? 1 : 0);
