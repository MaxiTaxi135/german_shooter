# IRON FRONT: WWII

A modular browser-based 3D battlefield prototype built with Three.js.

## Play

After GitHub Pages deployment succeeds:
https://maxitaxi135.github.io/german_shooter/

If it is not live yet, open **Actions** in the repository and check the **Deploy Iron Front to GitHub Pages** workflow. Make sure **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions**.

## Project structure

```
.
├── index.html
├── assets/
│   └── favicon.svg
├── styles/
│   └── main.css
├── src/
│   ├── main.js       # Game loop, player, input, and camera
│   ├── world.js      # Terrain, scenery, materials, and 3D models
│   ├── ai.js         # Infantry movement and behaviour
│   ├── weapons.js    # Inventory and combat systems
│   ├── ui.js         # HUD, start screen, and armory UI
│   └── config.js     # Game settings and equipment definitions
└── .github/
    └── workflows/
        └── pages.yml
```

## Controls

- **WASD**: move
- **Shift**: sprint
- **Space**: jump
- **Mouse**: look around
- **Right mouse button**: aim
- **R**: reload
- **B**: open/close the field armory
- **1–4**: equip a weapon you own
- **Esc**: release the mouse

## World and collision notes

Scenery uses visible 3D geometry and textured materials. Movement colliders cover buildings, trees, vehicles, crates, rocks, sandbags, fences, and infantry. Buildings use individual rotated wall colliders to preserve door openings. Solid scenery also occludes line-of-sight checks. Infantry movement includes obstacle avoidance and separation so patrols can move around cover instead of freezing in place.

## Technical notes

The page uses ES modules and an import map to load Three.js from a CDN. An internet connection is required. GitHub Actions publishes the root static site on pushes to `main`.
