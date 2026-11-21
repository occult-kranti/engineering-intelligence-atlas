#!/usr/bin/env python3
"""Capture v0.5 CEO Portfolio screenshots (dist/renderer/chrome.ceo-harness.html)."""
import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist" / "renderer"
OUT = ROOT / "dist" / "ux-screenshots"
OUT.mkdir(parents=True, exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
HARNESS = f"http://127.0.0.1:{PORT}/chrome.ceo-harness.html"


def shoot(page, name: str) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"))
    print(f"  {name}.png")


def scroll_to(page, selector: str) -> None:
    page.eval_on_selector(selector, "el => el.scrollIntoView({block: 'start'})")
    page.wait_for_timeout(250)


def ceo_scenarios(page, tag: str) -> None:
    page.goto(HARNESS)
    page.wait_for_timeout(400)
    shoot(page, f"{tag}-ceo-launcher")

    page.click("#open-ceo")
    page.wait_for_timeout(1400)  # enterprise load + snapshot + skills + ledger
    shoot(page, f"{tag}-ceo-top")

    # org graph (initial fit) + lists
    scroll_to(page, ".ent-graph-section")
    shoot(page, f"{tag}-ceo-graph")

    # program + partitions + controls
    headings = page.locator(".ent-section h3", has_text="Program")
    scroll_to(page, ".ent-partitions")
    shoot(page, f"{tag}-ceo-program")

    # contracts table
    scroll_to(page, ".ent-contracts-table")
    shoot(page, f"{tag}-ceo-contracts")

    # ledger + memory
    scroll_to(page, ".ent-ledger-bullets")
    shoot(page, f"{tag}-ceo-ledger")

    # stewards + employees
    scroll_to(page, ".ent-steward-card")
    shoot(page, f"{tag}-ceo-stewards")
    scroll_to(page, ".ent-worker-table")
    page.wait_for_timeout(600)
    shoot(page, f"{tag}-ceo-employees")

    # office tab still works (company deep link target)
    page.click("#tab-office")
    page.wait_for_timeout(800)
    shoot(page, f"{tag}-office-after-ceo")


with sync_playwright() as p:
    browser = p.chromium.launch()
    lg = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    lg.on("console", lambda m: print("console:", m.text) if m.type == "error" else None)
    lg.on("pageerror", lambda e: print("pageerror:", e))
    ceo_scenarios(lg, "lg")
    lg.close()

    sm = browser.new_page(viewport={"width": 900, "height": 600}, device_scale_factor=1)
    sm.on("pageerror", lambda e: print("pageerror:", e))
    ceo_scenarios(sm, "sm")
    sm.close()
    browser.close()
server.shutdown()

print("done ->", OUT)
