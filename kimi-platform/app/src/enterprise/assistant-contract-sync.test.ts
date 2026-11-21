import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Explicit twin parity for the Phase 0 assistant contract: the module and
 * its golden fixture must remain byte-identical between the web app
 * (app/contracts) and the desktop shell (desktop-shell/src/shared), with the
 * workspace root copy as the source of truth for the fixture.
 */

const appContracts = path.resolve(import.meta.dirname, "../../contracts");
const desktopShared = path.resolve(
  import.meta.dirname,
  "../../../desktop-shell/src/shared",
);
const rootDir = path.resolve(import.meta.dirname, "../../..");

describe("assistant contract twin parity", () => {
  it("assistant.ts is byte-identical in app and desktop-shell", () => {
    const appFile = path.join(appContracts, "assistant.ts");
    const desktopFile = path.join(desktopShared, "assistant.ts");
    expect(fs.existsSync(desktopFile), "desktop twin assistant.ts must exist").toBe(true);
    expect(fs.readFileSync(desktopFile, "utf8")).toBe(fs.readFileSync(appFile, "utf8"));
  });

  it("assistant-operations.fixture.json is byte-identical at root, app, and desktop", () => {
    const appFixture = path.join(appContracts, "assistant-operations.fixture.json");
    const desktopFixture = path.join(desktopShared, "assistant-operations.fixture.json");
    const rootFixture = path.join(rootDir, "assistant-operations.fixture.json");
    expect(fs.existsSync(desktopFixture), "desktop twin fixture must exist").toBe(true);
    expect(fs.existsSync(rootFixture), "root fixture must exist").toBe(true);
    const appBytes = fs.readFileSync(appFixture, "utf8");
    expect(fs.readFileSync(desktopFixture, "utf8")).toBe(appBytes);
    expect(fs.readFileSync(rootFixture, "utf8")).toBe(appBytes);
  });
});
