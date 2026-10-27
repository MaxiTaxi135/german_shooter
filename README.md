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
- **1–8**: equip a weapon you own
- **Esc**: release the mouse

## World and collision notes

Scenery uses textured 3D geometry, terrain-following roads, dynamic lighting, shadows and atmospheric fog. Physical colliders cover building wall segments (including clear door openings), trees, vehicles, crates, rocks, sandbags, fences and infantry. Weapon raycasts use the soldier body and head hitboxes, and world geometry blocks shots. NPC fire checks line of sight and target collision before applying damage. Infantry movement includes obstacle avoidance and body separation.

## Technical notes

The page uses ES modules and an import map to load Three.js from a CDN. An internet connection is required. GitHub Actions publishes the root static site on pushes to `main`.
