import { useEffect, useRef } from "react";
import type { PlanView } from "./PlanStage";

export interface HotkeyActions {
  openPalette(): void;
  openHelp(): void;
  /** switch the stage-02 view: graph/list plus the office views (G B/T/W) */
  setPlanView(view: PlanView): void;
  /** focus a workspace zone by id: queue | approvals | evidence | roadmap */
  focusZone(zone: "queue" | "approvals" | "evidence" | "roadmap"): void;
  /** move focus within the focused list (queue rows / approval cards) */
  moveItem(delta: 1 | -1): void;
  inspectFocused(): void;
  approveFocused(): void;
  rejectFocused(): void;
  requestStop(): void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * Director workspace keyboard map. Direct shortcuts are only active when the
 * user is not typing in a field. `g` is a prefix key (g then q/a/e/r).
 * Approval decisions (a/r) never fire directly — they open a confirmation.
 */
export function useDirectorHotkeys(actions: HotkeyActions, enabled = true) {
  const ref = useRef(actions);
  // Keep the latest handlers without touching refs during render.
  useEffect(() => {
    ref.current = actions;
  });

  useEffect(() => {
    if (!enabled) return;
    let gArmed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const a = ref.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        a.openPalette();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      if (gArmed) {
        gArmed = false;
        if (gTimer) clearTimeout(gTimer);
        const zone =
          key === "q" ? "queue"
          : key === "a" ? "approvals"
          : key === "e" ? "evidence"
          : key === "r" ? "roadmap"
          : null;
        if (zone) {
          e.preventDefault();
          a.focusZone(zone);
          return;
        }
        // Office views (stage 02): blueprint / team board / whiteboard.
        const officeView =
          key === "b" ? "blueprint"
          : key === "t" ? "team"
          : key === "w" ? "whiteboard"
          : null;
        if (officeView) {
          e.preventDefault();
          a.setPlanView(officeView);
        }
        return;
      }

      switch (key) {
        case "g":
          gArmed = true;
          gTimer = setTimeout(() => (gArmed = false), 1200);
          break;
        case "1":
          a.setPlanView("graph");
          break;
        case "2":
          a.setPlanView("list");
          break;
        case "j":
          a.moveItem(1);
          break;
        case "k":
          a.moveItem(-1);
          break;
        case "Enter":
          a.inspectFocused();
          break;
        case "A":
        case "a":
          a.approveFocused();
          break;
        case "R":
        case "r":
          a.rejectFocused();
          break;
        case "S":
        case "s":
          a.requestStop();
          break;
        case "?":
          a.openHelp();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [enabled]);
}
