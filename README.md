# IRON FRONT: WWII

A modular browser-based 3D WWII battlefield prototype built with Three.js. The player fights with a small three-soldier Allied squad against continuous enemy reinforcements.

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

## Squads and reinforcements

You start with **three Allied soldiers**. Allied troops wear olive-drab uniforms with pale identification markings; enemy infantry wear slate-grey uniforms, charcoal helmets, and muted red armbands. The HUD shows the number of active hostiles.

The first wave has 12 enemies. Defeated enemies are cleared from the battlefield after a short delay, and replacements spawn around the player at safe points. Active enemy infantry are replenished up to a limit of 12, so new opponents continue arriving as you defeat them.

## World and collision notes

Scenery uses textured 3D geometry, terrain-following roads, dynamic lighting, shadows and atmospheric fog. Physical colliders cover building wall segments (including clear door openings), trees, vehicles, crates, rocks, sandbags, fences and infantry. Weapon raycasts use the soldier body and head hitboxes, and world geometry blocks shots. NPC fire checks line of sight and target collision before applying damage. Infantry movement includes obstacle avoidance and body separation.

## Technical notes

The page uses ES modules and an import map to load Three.js from a CDN. An internet connection is required. GitHub Actions publishes the root static site on pushes to `main`.
