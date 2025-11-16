# Stray Snake

This repository is a tiny Godot 4 playground that experiments with **ternary movement** for a snake roguelite. The serpent slides along three vectors that are 120° apart instead of the traditional four-direction grid, so you can immediately feel how rooms and combat patterns need to be redesigned for a triangular lattice.

## Quick start

1. Install [Godot 4.2+](https://godotengine.org/).
2. Open this folder as a project.
3. Press <kbd>F5</kbd> to run – the project now boots directly into the ternary movement scene.

## Controls

| Action | Key |
| --- | --- |
| Rotate left | <kbd>Q</kbd> |
| Rotate right | <kbd>E</kbd> |
| Grow a tail segment | <kbd>Space</kbd> |

Every few frames the head advances one step along the currently selected vector. The rest of the body is a queue that follows the head, letting you “orbit” targets with short arcs or swing wide to carve equilateral patterns.

## Files of interest

- `snake.gd` – self-contained Node2D that handles movement, growth, and debug rendering of the triangular grid.
- `2d_min_gfx.tscn` – the minimal scene instantiating the snake Node2D.
- `project.godot` – project configuration; now points to the correct main scene so the prototype runs immediately.

## Roadmap

- Add proper collision so the snake can’t overlap itself.
- Build combat rooms around the triangular flow.
- Drop-in powerups that temporarily bend the 120° rules.

Contributions and experiments are welcome – the entire prototype is intentionally tiny so it’s easy to remix.
