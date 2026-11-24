"""Typed models for the bundled catalog (boards + modules).

Boards are loaded from ``catalog/data/boards/<id>.yaml``; modules from
``catalog/data/modules/<id>/module.yaml``. Both schemas are intentionally
small and declarative — no Python in the manifests.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# --------------------------------------------------------------------- boards

PortInterface = Literal["i2c", "gpio", "digital", "analog", "uart"]
ModuleCategory = Literal[
    "sensor",
    "input",
    "display",
    "actuator",
    "led",
    "connectivity",
    "audio",
    "motor",
    "distance",
    "light",
    "robotics",
    "storage",
]
ModuleInterface = Literal["i2c", "gpio", "analog", "uart"]


class Pin(BaseModel):
    """One pin on a port."""

    model_config = ConfigDict(extra="ignore")

    gpio: int
    function: str = "signal"


class PortSpec(BaseModel):
    """One port on a motherboard."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: Optional[str] = None
    type: Optional[str] = "universal"
    slot_number: Optional[int] = None
    side: Optional[str] = None
    pins: list[Pin] = Field(default_factory=list)
    compatible_interfaces: list[PortInterface] = Field(default_factory=list)


class BoardSpec(BaseModel):
    """One motherboard layout."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    microcontroller: dict = Field(default_factory=dict)
    platformio_env: str = "esp32-s3-devkitc-1"
    platformio_framework: str = "arduino"
    # Flash baud. Boards whose USB-JTAG bridge can't survive esptool's
    # rate change override this (see 10port).
    upload_speed: int = 460800
    ports: list[PortSpec] = Field(default_factory=list)
    adjacent_port_pairs: list[tuple[str, str]] = Field(default_factory=list)
    reserved: list[str] = Field(default_factory=list)
    layout: list[list[str]] = Field(default_factory=list)
    notes: Optional[str] = None

    def port(self, port_id_or_num: str | int) -> PortSpec:
        """Look up a port by ``"port_3"`` or ``3``."""
        pid = port_id_or_num if isinstance(port_id_or_num, str) else f"port_{port_id_or_num}"
        for p in self.ports:
            if p.id == pid:
                return p
        raise KeyError(f"port {pid!r} not found on board {self.id!r}")

    @property
    def port_ids(self) -> list[str]:
        return [p.id for p in self.ports]

    def is_adjacent(self, a: str, b: str) -> bool:
        return (a, b) in self.adjacent_port_pairs or (b, a) in self.adjacent_port_pairs


# -------------------------------------------------------------------- modules


class ModuleTemplates(BaseModel):
    """Jinja2 source fragments stitched into the generated ``main.cpp``.

    Available variables in every template:

    - ``instance``: the C++ instance name (e.g. ``aht20_1``)
    - ``port_id``: the port id (e.g. ``"port_3"``)
    - ``pin_a`` / ``pin_b``: the two GPIO numbers from the port
    - For double-width modules, also ``pin_a2`` / ``pin_b2`` from the secondary port.
    """

    model_config = ConfigDict(extra="forbid")

    globals: str = ""
    setup: str = ""
    loop: str = ""


class ModuleDriver(BaseModel):
    """Driver source files bundled with the module."""

    model_config = ConfigDict(extra="ignore")

    header: str
    source: Optional[str] = None
    class_name: str
    # Headers from the catalog's shared ``drivers/`` folder (e.g. ``i2c_software.h``)
    # that the generated code uses. Codegen copies that folder into the project once.
    shared: list[str] = Field(default_factory=list)


class EventDecl(BaseModel):
    """An event that a module's firmware emits."""

    model_config = ConfigDict(extra="ignore")

    key: str
    type: Literal["sensor", "button", "state", "log"] = "sensor"
    value_type: Literal["float", "int", "bool", "string", "json"] = "float"
    unit: Optional[str] = None
    description: Optional[str] = None


class FeedbackSignal(BaseModel):
    """Something an input module senses, for the default feedback on output modules.

    When a project has no ``code.loop``, the firmware shows these on the placed
    outputs (screen, light grid, button light, speaker; motors only follow a person).
    """

    model_config = ConfigDict(extra="forbid")

    label: str                       # Jinja with {{ instance }}; short, shown on the screen
    value: str                       # C++ expression (Jinja), read every 50 ms; must not consume an edge
    kind: Literal["level", "press"] = "level"
    range: tuple[float, float] = (0.0, 1.0)   # value at 0 % and at 100 %; reversed = closer is more
    unit: str = ""
    decimals: int = 0
    person: bool = False             # a person's hand (button, knob): may drive a motor


class ActionDecl(BaseModel):
    """An action that a module's firmware accepts."""

    model_config = ConfigDict(extra="ignore")

    key: str
    value_type: Literal["float", "int", "bool", "string", "json", "null"] = "json"
    description: Optional[str] = None
    handler: Optional[str] = Field(
        default=None,
        description=(
            "C++ run by the generated firmware when this action arrives (Jinja, with "
            "`{{ instance }}`). The action's value is the Arduino `String value`. "
            "Helpers: `atechNum(value, \"field\", fallback)` reads a number out of a "
            "JSON object, `atechNums(value, \"field\", out, max)` a number array, "
            "`atechTruthy(value)` a bool. An action without a handler is documentation "
            "only: the firmware answers it with `ok:false`."
        ),
    )


class ModuleSpec(BaseModel):
    """A module the user can place on a board."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str                        # the part: "ST7735 TFT Color Display (160x80)"
    #: what people call it, as studio's module pages do: "Screen". A module of the
    #: user's own may leave it out; ``label`` then falls back to ``name``.
    display_name: Optional[str] = None
    category: ModuleCategory
    interface: ModuleInterface = "gpio"
    size: Literal[1, 2] = 1
    i2c_address: Optional[int] = None
    driver: ModuleDriver
    templates: ModuleTemplates = Field(default_factory=ModuleTemplates)
    events: list[EventDecl] = Field(default_factory=list)
    actions: list[ActionDecl] = Field(default_factory=list)
    lib_deps: list[str] = Field(default_factory=list)
    health_check: Optional[str] = Field(
        default=None,
        description=(
            "Optional C++ boolean expression (Jinja, with `{{ instance }}`) that "
            "returns true when the module's hardware is actually responding — e.g. "
            "`{{ instance }}.isConnected()` for an I2C sensor. Emitted in the boot "
            "diagnostics so `atech check` can report 'not responding' instead of a "
            "silent failure. Leave unset for modules with no read-back (the report "
            "then says the module initialized but presence is not detectable)."
        ),
    )
    description: Optional[str] = None
    spi_host: bool = Field(
        default=False,
        description=(
            "The module cannot run without one of the chip's two hardware SPI hosts "
            "(the microSD card). Generated setup() calls atech::reserveSpiHosts(n) "
            "before any begin(), so a screen takes a host only if one is left and "
            "otherwise bit-bangs (atech_spi_hosts.h)."
        ),
    )
    max_per_project: Optional[int] = Field(
        default=None,
        description=(
            "How many of this module one project can hold, when the firmware cannot "
            "serve more (the distance sensor needs the chip's one hardware I2C bus). "
            "Unset = no limit. `atech validate` refuses more."
        ),
    )
    feedback: list[FeedbackSignal] = Field(
        default_factory=list,
        description="What this input shows on the outputs when the project has no code.loop.",
    )
    feedback_output: Optional[Literal["screen", "grid", "light", "sound", "motor", "stepper"]] = Field(
        default=None,
        description="How this output shows the inputs in the default feedback (codegen's feedback.py).",
    )
    caution: Optional[str] = Field(
        default=None,
        description=(
            "Safety note for modules that can damage hardware when wired or "
            "powered wrongly (e.g. a servo bus fed from the board's high-voltage rail). "
            "Printed by `atech validate` / `build` / `upload` and included in "
            "`Project.describe()`, so both the person and their coding agent see "
            "it before anything is powered."
        ),
    )
    usage: Optional[str] = Field(
        default=None,
        description=(
            "Short C++ snippet showing the public API of this module, with "
            "the instance name `{{ instance }}` as a placeholder. Read by "
            "coding agents to know what methods to call in user code blocks."
        ),
    )

    @property
    def label(self) -> str:
        """The short name for people (the viewer, the hover card): ``display_name`` or ``name``."""
        return self.display_name or self.name

