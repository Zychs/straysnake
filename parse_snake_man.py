#!/usr/bin/env python3
"""Parse snake-man.html and its modules into the Godot 4 Snake-Man project.

Re-running this script rewrites straysnake/rules.gd, project.godot, and
snake_man.tscn from the HTML. The playable rules are the template with the
parsed facts filled in.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "snake-man.html"
OUT = ROOT / "straysnake"
TEMPLATE = OUT / "rules.gd.tmpl"

REQUIRED = (
    "core.js",
    "state.js",
    "kin.js",
    "map.js",
    "pellets.js",
    "player.js",
    "ghosts.js",
    "coat.js",
    "dash.js",
    "heal.js",
    "game.js",
    "input.js",
)


def eval_expr(src: str) -> int | float:
    text = src.strip().replace("t", "0") if False else src.strip()
    tree = ast.parse(text, mode="eval")
    allowed = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Constant,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.FloorDiv,
        ast.Mod,
        ast.Pow,
        ast.USub,
        ast.UAdd,
        ast.Load,
    )
    for node in ast.walk(tree):
        if not isinstance(node, allowed):
            raise ValueError(f"unsafe expr: {src}")
    value = eval(compile(tree, "<parsed>", "eval"), {"__builtins__": {}})
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def eval_with_t(src: str) -> int | float:
    return eval_expr(src.replace("t", "0"))


def grab(src: str, name: str) -> int | float:
    match = re.search(rf"\b{name}\s*=\s*([^,;\n]+)", src)
    if not match:
        raise SystemExit(f"missing {name}")
    return eval_expr(match.group(1))


def script_order(html: str) -> list[str]:
    found = re.findall(r"<script\s+src=\"([^\"]+)\"", html)
    names = [Path(item).name for item in found]
    missing = [name for name in REQUIRED if name not in names]
    if missing:
        raise SystemExit("html script tags missing: " + ", ".join(missing))
    return found


def load_modules(order: list[str]) -> dict[str, str]:
    texts: dict[str, str] = {}
    for rel in order:
        path = (HTML.parent / rel).resolve()
        if not path.is_file():
            raise SystemExit(f"missing module {path}")
        texts[Path(rel).name] = path.read_text(encoding="utf-8")
    return texts


def time_label(ms: int) -> str:
    total = int(ms) // 1000
    return f"{total // 60}:{total % 60:02d}"


def facts_from(modules: dict[str, str], order: list[str]) -> dict[str, str]:
    core = modules["core.js"]
    kin = modules["kin.js"]
    player = modules["player.js"]
    ghosts = modules["ghosts.js"]
    coat = modules["coat.js"]
    dash = modules["dash.js"]
    heal = modules["heal.js"]
    game_map = modules["map.js"]
    inputs = modules["input.js"]

    tile = int(grab(core, "TILE_COUNT"))
    grid = int(grab(core, "GRID_SIZE"))
    width = int(grab(core, "W"))
    view = width // grid
    limit = int(grab(core, "TIME_LIMIT_MS"))
    stages = re.search(r"const STAGES = \[(.*?)\];", game_map, re.S)
    if not stages:
        raise SystemExit("missing STAGES")
    ats = [int(item) for item in re.findall(r"at:\s*(\d+)", stages.group(1))]
    zones = [item for item in ats if item > 0]
    if len(zones) != 3:
        raise SystemExit(f"expected 3 zone thresholds, got {zones}")

    score_block = re.search(
        r"if \(kind === 2\) \{\s*G\.score \+= (\d+);.*?else \{\s*G\.score \+= (\d+);",
        player,
        re.S,
    )
    if not score_block:
        raise SystemExit("missing pellet scores")
    chain = re.search(r"(\d+) \* 2 \*\* Math\.min\((\d+)", player)
    if not chain:
        raise SystemExit("missing prism chain")

    leads: dict[str, tuple[int, int]] = {}
    for line in ghosts.splitlines():
        named = re.search(r"name: '([A-Z]+)'", line)
        if not named:
            continue
        pred = re.search(r"predict\((\d+),\s*(\d+)\)", line)
        if pred:
            leads[named.group(1)] = (int(pred.group(1)), int(pred.group(2)))
        elif named.group(1) == "CLYDE" and "trailCentroid" not in line:
            raise SystemExit("CLYDE is not the trail centroid")
    for name in ("BLINKY", "PINKY", "INKY"):
        if name not in leads:
            raise SystemExit(f"missing {name} predict")
    if "CLYDE" not in ghosts:
        raise SystemExit("missing CLYDE")

    forage = re.search(r"forage:.*?goal:\s*([^,]+),\s*win:\s*([^,\n}]+)", heal, re.S)
    if not forage:
        raise SystemExit("missing forage rung")
    bank = re.search(r"const pts = (\d+) \* \(rung \+ 1\)", heal)
    if not bank:
        raise SystemExit("missing life-cap bank")

    self_inv = re.search(r"G\.invuln = (\d+)", player)
    if not self_inv:
        raise SystemExit("missing self-hit invulnerability")

    for needle, label in (
        ("ArrowUp", "arrows"),
        ("Shift", "Shift"),
        ("Escape", "Escape"),
        ("k === ' '", "Space"),
    ):
        if needle not in inputs:
            raise SystemExit(f"input verb missing: {label}")
    if not re.search(r"\bw:\s*DIRS\[0\]", inputs):
        raise SystemExit("input verb missing: WASD")

    pinky_t = leads["PINKY"][1]
    inky_t = leads["INKY"][1]
    if leads["PINKY"][0] != 1 or leads["INKY"][0] != 2 or leads["BLINKY"][0] != 0:
        raise SystemExit(f"unexpected derivative orders: {leads}")

    values: dict[str, str] = {
        "MODULES": " ".join(order),
        "VERBS": "verbs: move arrows/WASD, dig Shift, turncoat Escape, pause Space",
        "TILE_COUNT": str(tile),
        "VIEW": str(view),
        "TIME_LIMIT_MS": str(limit),
        "TIME_LABEL": time_label(limit),
        "START_LIVES": str(int(grab(core, "START_LIVES"))),
        "MAX_LIVES": str(int(grab(core, "MAX_LIVES"))),
        "PELLET_SCORE": score_block.group(2),
        "RAINBOW_SCORE": score_block.group(1),
        "ZONE_0": str(zones[0]),
        "ZONE_1": str(zones[1]),
        "ZONE_2": str(zones[2]),
        "GHOST_BLINKY": "BLINKY",
        "GHOST_PINKY": "PINKY",
        "GHOST_INKY": "INKY",
        "GHOST_CLYDE": "CLYDE",
        "DASH_TILES": str(int(grab(dash, "DASH_TILES"))),
        "DASH_MIN": str(int(grab(dash, "DASH_MIN"))),
        "DASH_COOL_MS": str(int(grab(dash, "DASH_COOL_MS"))),
        "INVULN_MS": str(int(grab(core, "INVULN_MS"))),
        "SELF_INVULN_MS": self_inv.group(1),
        "FORAGE_GOAL": str(int(eval_with_t(forage.group(1)))),
        "FORAGE_WIN": str(int(eval_with_t(forage.group(2)))),
        "BANK_POINTS": bank.group(1),
        "TRAITOR_MS": str(int(grab(coat, "TRAITOR_MS"))),
        "BUSTED_COOL_MS": str(int(grab(coat, "BUSTED_COOL_MS"))),
        "COAT_MS": str(int(grab(coat, "COAT_MS"))),
        "COAT_COOL_MS": str(int(grab(coat, "COAT_COOL_MS"))),
        "LUNGE_OVERSHOOT": str(int(grab(core, "LUNGE_OVERSHOOT"))),
        "V_GAIN": str(grab(kin, "V_GAIN")),
        "A_GAIN": str(grab(kin, "A_GAIN")),
        "PINKY_LEAD": str(pinky_t),
        "INKY_LEAD": str(inky_t),
        "GHOST_BASE": chain.group(1),
        "CHAIN_CAP": chain.group(2),
    }
    return values


def fill_template(values: dict[str, str]) -> str:
    text = TEMPLATE.read_text(encoding="utf-8")
    for key, value in values.items():
        token = f"__{key}__"
        if token not in text:
            raise SystemExit(f"template missing {token}")
        text = text.replace(token, value)
    leftover = re.findall(r"__[A-Z0-9_]+__", text)
    if leftover:
        raise SystemExit("unreplaced: " + ", ".join(leftover))
    return text


def write_project() -> None:
    project = """; Engine configuration file.
; Rewritten by parse_snake_man.py from snake-man.html.

config_version=5

[application]

config/name="Snake-Man"
run/main_scene="res://snake_man.tscn"
config/features=PackedStringArray("4.4", "GL Compatibility")
config/icon="res://icon.svg"

[display]

window/size/viewport_width=800
window/size/viewport_height=800

[debug]

gdscript/warnings/inferred_variant=0

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
"""
    scene = """[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://snake_man.gd" id="1_snake"]

[node name="SnakeMan" type="Node2D"]
script = ExtResource("1_snake")
"""
    (OUT / "project.godot").write_text(project, encoding="utf-8", newline="\n")
    (OUT / "snake_man.tscn").write_text(scene, encoding="utf-8", newline="\n")


def main() -> int:
    html = HTML.read_text(encoding="utf-8")
    order = script_order(html)
    modules = load_modules(order)
    values = facts_from(modules, order)
    rules = fill_template(values)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "rules.gd").write_text(rules, encoding="utf-8", newline="\n")
    write_project()
    print("parsed", HTML)
    print("modules", values["MODULES"])
    print(values["VERBS"])
    print(
        "tile",
        values["TILE_COUNT"],
        "view",
        values["VIEW"],
        "time",
        values["TIME_LABEL"],
        values["TIME_LIMIT_MS"],
    )
    print(
        "lives",
        values["START_LIVES"],
        values["MAX_LIVES"],
        "scores",
        values["PELLET_SCORE"],
        values["RAINBOW_SCORE"],
    )
    print("zones", values["ZONE_0"], values["ZONE_1"], values["ZONE_2"])
    print(
        "ghosts",
        values["GHOST_BLINKY"],
        values["GHOST_PINKY"],
        values["GHOST_INKY"],
        values["GHOST_CLYDE"],
    )
    print("wrote", OUT / "rules.gd")
    print("wrote", OUT / "project.godot")
    print("wrote", OUT / "snake_man.tscn")
    return 0


if __name__ == "__main__":
    sys.exit(main())
