# Stray Snake  
An action-roguelite prototype where movement *is* the attack.

Stray Snake is a compact, Binding-of-Isaac–style top-down roguelite built around a single escalating mechanic:  
you play a lone serpent whose body grows segment by segment, and each new segment mutates your entire combat style.

This repository contains the first playable vertical slice: a short dungeon run, a controllable serpent with evolving traits, two enemy archetypes, and a room-to-room combat loop.

---

## Features

### 🐍 Evolving Serpent  
- The player character is a multi-segment snake.  
- Each new segment grants a **unique trait** (e.g., fire trail, poison drag, contact aura).  
- Segments follow the head using queued positions or follower interpolation.  
- Movement doubles as your primary attack: enemies are damaged by the body’s trail, collision properties, or elemental signatures.

### 🧩 Compact Dungeon Structure  
- One floor made of several rooms connected linearly or by doors.  
- Combat rooms lock in until cleared.  
- Clear rewards: one new segment pickup per room.

### ⚔️ Enemies  
- **Chaser**: closes distance and deals contact damage.  
- **Shooter**: attempts to maintain space and fires at intervals.  
- Room compositions scale difficulty slightly as the run progresses.

### 💥 Combat Flow  
- No traditional weapon.  
- Attacks emerge entirely from movement, segment traits, and the player’s ability to weave through crowds.  
- High-mobility, high-risk gameplay loop.

---

## Project Structure

/assets → sprites, shaders, SFX (if included)
/src → scripts, objects, gameplay logic
/docs → design notes and concept references
/build → exported prototypes
README.md
LICENSE

yaml
Copy code

(Directory names may differ per engine.)

---

## Controls

- **Move:** WASD or arrow keys  
- **Aim/Face Direction:** Mouse (engine-dependent)  
- **Dash (optional):** Shift or Space  
- **Interact / Confirm:** E or Left Click

---

## Segment Traits (Prototype Set)

- **Fire Trail:** leaves burning patches on the ground.  
- **Poison Drag:** enemies crossing the trail take DoT.  
- **Spike Aura:** radial contact damage from the segment’s center.  

Traits are modular and defined as simple components for fast iteration.

---

## Build & Run

### GameMaker Studio  
Open the `.yyp` project file in GameMaker Studio 2.  
Run via the built-in runner.

### Godot  
Open the project in Godot 4.x.  
Run using the default scene.  
Music and sound are synthesized in code (`chiptune.gd`, `music.gd`, `sfx.gd`); press V to mute.

### Snake-Man (browser)  
Open `snake-man.html`.  
Same music and cues as the Godot port, synthesized with Web Audio (`snake-man/music.js`, `snake-man/sfx.js`); press V to mute.

---

## Roadmap

### Vertical Slice (Current)
- Basic movement & collision  
- Segment growth and trait system  
- Small dungeon with fixed rooms  
- Two enemy types  
- Win/lose end screens

### Near-Term Additions  
- Procedural dungeon layout  
- Additional segment traits  
- Boss encounter  
- Meta-progression hooks  
- Shader-based neon serpent rendering

---

## License
MIT License (or specify your preferred license).

---

## Credits
Design & Programming: <Your Name>  
Special thanks to early testers, supporters, and collaborators.

---

## Notes
This project is in active development and intended as a fast prototype for presenting mechanics, gameplay feel, and creative direction. Code and systems are structured for rapid iteration rather than long-term architectural stability.
