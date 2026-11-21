#!/usr/bin/env python3
"""Capture v0.4 UX screenshots from the harness build (dist/renderer/chrome.harness.html)."""
import functools
import http.server
import pathlib
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist" / "renderer"
OUT = ROOT / "dist" / "ux-screenshots"
OUT.mkdir(parents=True, exist_ok=True)

# chrome.js is an ES module: file:// blocks module CORS, so serve locally.
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
HARNESS = f"http://127.0.0.1:{PORT}/chrome.harness.html"


def shoot(page, name: str) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"))
    print(f"  {name}.png")


def office_scenarios(page, tag: str) -> None:
    page.goto(HARNESS)
    page.wait_for_timeout(400)
    page.click("#open-projects")
    page.wait_for_timeout(1200)  # selection + snapshot + timeline + approvals + chat sessions
    shoot(page, f"{tag}-office")

    page.click("#insp-tab-chat")
    page.wait_for_timeout(400)
    shoot(page, f"{tag}-chat")

    # close chat, open approvals
    page.click("#insp-tab-approvals")
    page.wait_for_timeout(300)
    shoot(page, f"{tag}-approvals")

    page.click("#tab-roadmap")
    page.wait_for_timeout(300)
    shoot(page, f"{tag}-roadmap")

    if tag == "lg":
        page.click("#tab-skills")
        page.wait_for_timeout(500)
        shoot(page, f"{tag}-skills")

        page.click("#tab-office")
        page.wait_for_timeout(200)
        page.click("#project-new")
        page.wait_for_timeout(400)
        shoot(page, f"{tag}-dialog-new-project")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # companion panel in connections
        page.click("#tab-connections")
        page.wait_for_timeout(400)
        shoot(page, f"{tag}-connections")


with sync_playwright() as p:
    browser = p.chromium.launch()
    lg = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    lg.on("console", lambda m: print("console:", m.text) if m.type == "error" else None)
    lg.on("pageerror", lambda e: print("pageerror:", e))
    office_scenarios(lg, "lg")
    lg.close()

    sm = browser.new_page(viewport={"width": 900, "height": 600}, device_scale_factor=1)
    sm.on("pageerror", lambda e: print("pageerror:", e))
    office_scenarios(sm, "sm")
    sm.close()
    browser.close()
server.shutdown()

print("done ->", OUT)
