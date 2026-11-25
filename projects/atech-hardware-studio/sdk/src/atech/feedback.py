"""Default feedback: show what the input modules sense on the output modules.

A project with inputs (button, knob, sensors) and outputs (screen, light grid,
button light, speaker, motors) and no ``code.loop`` gets a loop block that
reacts to every input on every output, so a fresh build already does something
visible. ``feedback: false`` in project.yaml turns it off; ``feedback: true``
keeps it next to a ``code.loop``.

The signals come from each input's ``feedback:`` in module.yaml, the renderers
from each output's ``feedback_output:``. Rules:

- Nothing here consumes an edge (``wasPressed()`` and friends stay the user's).
- Motors only follow a person's hand (``person: true``: button, knob), never a
  sensor. The robot arm is never moved.
- Outputs are written when what they show changes, so an action from the laptop
  (``led_fill``) stays until the next input change.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING

from jinja2 import Template

if TYPE_CHECKING:  # pragma: no cover
    from atech.catalog.models import FeedbackSignal
    from atech.project import Project

#: Outputs a screen-less, light-less project is told to add.
SUGGESTED_OUTPUTS = ("neopixel", "st7735_tft")


@dataclass(frozen=True)
class _Signal:
    label: str
    value: str
    kind: str
    lo: float
    hi: float
    unit: str
    decimals: int
    person: bool


def _signals(project: "Project") -> list[_Signal]:
    specs = project.module_specs()
    out: list[_Signal] = []
    for pm in project.modules:
        for f in specs[pm.module_id].feedback:
            out.append(_render_signal(f, pm.instance))
    return out


def _render_signal(f: "FeedbackSignal", instance: str) -> _Signal:
    r = lambda t: Template(t).render(instance=instance)  # noqa: E731
    return _Signal(r(f.label), r(f.value), f.kind, float(f.range[0]), float(f.range[1]),
                   f.unit, f.decimals, f.person)


def _outputs(project: "Project") -> list[tuple[str, str]]:
    """``(instance, kind)`` of every placed output."""
    specs = project.module_specs()
    return [(pm.instance, specs[pm.module_id].feedback_output)
            for pm in project.modules if specs[pm.module_id].feedback_output]


def feedback_active(project: "Project") -> bool:
    """True when the generated firmware carries the feedback block."""
    mode = getattr(project, "feedback", "auto")
    if mode is False:
        return False
    if mode == "auto" and (project.loop_code or "").strip():
        return False
    signals = _signals(project)
    outputs = _outputs(project)
    if not signals or not outputs:
        return False
    # Inputs whose only outputs are motors and no person input: nothing to show.
    shown = {kind for _, kind in outputs if kind not in ("motor", "stepper")}
    return bool(shown) or any(s.person for s in signals)


def tips(project: "Project") -> list[str]:
    """Notes for the person and their agent: what feedback does, what to add."""
    out: list[str] = []
    signals = _signals(project)
    outputs = _outputs(project)
    if signals and not any(kind in ("screen", "grid", "light") for _, kind in outputs):
        out.append(
            "This project has inputs but nothing to see them on. Add a light grid "
            "(`neopixel`) or a screen (`st7735_tft`): with no code.loop the firmware "
            "then shows every input there by itself (`atech info neopixel`)."
        )
    if feedback_active(project):
        names = ", ".join(f"{inst} ({kind})" for inst, kind in outputs)
        out.append(
            f"Default feedback is on: the firmware shows the inputs on {names}. "
            "Motors follow only a button or knob. Write code.loop (or set "
            "`feedback: false`) to replace it."
        )
        if any(kind in ("motor", "stepper") for _, kind in outputs) and not any(s.person for s in signals):
            out.append("The motors stay still in the default feedback: no button or knob to follow.")
    return out


def _c_string(text: str) -> str:
    return json.dumps(text)


def render_feedback(project: "Project") -> str:
    """The C++ for ``loop()``; empty when feedback is off for this project."""
    if not feedback_active(project):
        return ""
    signals = _signals(project)
    outputs = _outputs(project)
    L: list[str] = []
    add = L.append
    add("// ---- atech default feedback: inputs shown on the outputs ----")
    add("// (generated because code.loop is empty; `feedback: false` in project.yaml turns it off)")
    add("{")
    add("    static unsigned long fbAt = 0;")
    add("    static unsigned long fbTick = 0;")
    add("    if (millis() - fbAt >= 50) {   // 20 Hz")
    add("        fbAt = millis();")
    add("        fbTick++;")
    n = len(signals)
    add(f"        static bool fbPrev[{n}] = {{}};")
    add(f"        float fbV[{n}];   // raw values")
    add(f"        float fbL[{n}];   // 0..1")
    add(f"        bool fbOn[{n}];   // press active")
    add("        bool fbAny = false;      // any press")
    add("        bool fbHand = false;     // a person's press")
    for i, s in enumerate(signals):
        add(f"        fbV[{i}] = (float)({s.value});")
        if s.kind == "level":
            span = s.hi - s.lo
            add(f"        fbL[{i}] = constrain((fbV[{i}] - ({s.lo}f)) / ({span}f), 0.0f, 1.0f);")
            add(f"        fbOn[{i}] = false;")
        else:
            add(f"        fbOn[{i}] = fbV[{i}] != 0.0f;")
            add(f"        fbL[{i}] = fbOn[{i}] ? 1.0f : 0.0f;")
            add(f"        fbAny = fbAny || fbOn[{i}];")
            if s.person:
                add(f"        fbHand = fbHand || fbOn[{i}];")
    levels = [i for i, s in enumerate(signals) if s.kind == "level"]
    person_levels = [i for i in levels if signals[i].person]
    person_presses = [i for i, s in enumerate(signals) if s.kind == "press" and s.person]
    add("        (void)fbHand;")

    for inst, kind in outputs:
        add(f"        // {inst}: {kind}")
        if kind == "screen":
            _screen(add, inst, signals)
        elif kind == "grid":
            _grid(add, inst, levels)
        elif kind == "light":
            add("        {")
            add("            static int8_t was = -1;")
            add("            if ((int8_t)fbAny != was) {")
            add("                was = fbAny;")
            add(f"                if (fbAny) {inst}.setColor(0, 120, 255); else {inst}.off();")
            add("            }")
            add("        }")
        elif kind == "sound":
            for i, s in enumerate(signals):
                if s.kind != "level":
                    add(f"        if (fbOn[{i}] && !fbPrev[{i}]) {inst}.playTone({660 + 110 * i}, 60);   // {s.label}")
        elif kind == "motor":
            if person_levels:
                i = person_levels[0]
                add(f"        {{ int sp = (int)(fbL[{i}] * 255); static int was = -1;"
                    f" if (sp != was) {{ was = sp; {inst}.setSpeed(sp); }} }}   // {signals[i].label}")
            elif person_presses:
                add(f"        {{ int sp = fbHand ? 180 : 0; static int was = -1;"
                    f" if (sp != was) {{ was = sp; {inst}.setSpeed(sp); }} }}")
        elif kind == "stepper":
            if person_levels:
                i = person_levels[0]
                add(f"        {{   // follows {signals[i].label}: a short move per pass (step() blocks)")
                add(f"            long target = (long)(fbL[{i}] * 800);")
                add(f"            long d = target - (long){inst}.getPosition();")
                add("            if (d != 0) { long m = d > 16 ? 16 : (d < -16 ? -16 : d);"
                    f" {inst}.moveSteps(m, 3200); }}")
                add("        }")
            elif person_presses:
                add(f"        if (fbHand) {inst}.moveSteps(16, 3200);   // a short move per pass while held")

    for i, s in enumerate(signals):
        if s.kind != "level":
            add(f"        fbPrev[{i}] = fbOn[{i}];")
    add("    }")
    add("}")
    return "\n".join(L)


def _screen(add, inst: str, signals: list[_Signal]) -> None:
    # Laid out for 160x80: a title and 7 rows of 10 px. A wider screen (the Big
    # Screen, 320x240) draws the same layout s times larger.
    rows = signals[:7]
    add("        if (fbTick % 4 == 0) {   // 5 Hz")
    add(f"            const int s = {inst}.width() >= 320 ? 2 : 1;")
    add(f"            {inst}.clear();")
    add(f"            {inst}.displayText(\"inputs\", 2 * s, 1 * s, s, ATECH_MUTED);")
    add("            char line[32];")
    for i, s in enumerate(rows):
        y = 12 + 10 * i
        label = _c_string(s.label)
        if s.kind == "level":
            add(f"            snprintf(line, sizeof line, \"%-9.9s %.{s.decimals}f%s\", {label}, fbV[{i}], {_c_string(s.unit)});")
        else:
            add(f"            snprintf(line, sizeof line, \"%-9.9s %s\", {label}, fbOn[{i}] ? \"down\" : \"up\");")
        add(f"            {inst}.displayText(line, 2 * s, {y} * s, s, ATECH_FG);")
        add(f"            {inst}.drawRect(100 * s, {y} * s, 58 * s, 7 * s, ATECH_HAIRLINE);")
        add(f"            {inst}.fillRect(100 * s, {y} * s, (int)(58 * s * fbL[{i}]), 7 * s, fbOn[{i}] ? ATECH_OK : ATECH_ACCENT);")
    add(f"            {inst}.display();")
    add("        }")


def _grid(add, inst: str, levels: list[int]) -> None:
    add("        {")
    if levels:
        i = levels[0]
        add(f"            int lit = (int)(fbL[{i}] * 9 + 0.5f);   // first level input as a bar")
        add(f"            uint8_t r = (uint8_t)(255 * fbL[{i}]), g = (uint8_t)(255 * (1 - fbL[{i}]));")
    else:
        add("            int lit = 0; uint8_t r = 0, g = 0;")
    add("            long key = fbAny ? -1 : (long)lit * 65536L + r * 256L + g;")
    add("            static long was = -2;")
    add("            if (key != was) {")
    add("                was = key;")
    add(f"                if (fbAny) {inst}.setAll(0, 80, 255);   // a press: the whole grid")
    add("                else {")
    add(f"                    {inst}.clear();")
    add(f"                    for (int k = 0; k < lit; k++) {inst}.setPixel(k, r, g, 0);")
    add("                }")
    add(f"                {inst}.show();")
    add("            }")
    add("        }")
