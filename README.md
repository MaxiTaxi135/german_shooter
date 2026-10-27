# IRON FRONT: WWII

A browser-based, stylized first-person WWII battlefield prototype built with Three.js.

## Play
After GitHub Pages is enabled and the workflow finishes, open:
https://maxitaxi135.github.io/german_shooter/

## Controls
- **WASD**: move
- **Shift**: sprint
- **Space**: jump
- **Mouse**: look around
- **Hold left mouse button**: fire
- **Right mouse button**: aim
- **R**: reload
- **B**: field armory
- **1–4**: switch to owned weapons

## Notes
The game loads Three.js from a CDN, so an internet connection is required. Graphics use real-time lighting, shadows, fog, procedural terrain textures, and generated battlefield props. This is an evolving prototype; some combat and animations are simplified.

## Hosting
A GitHub Actions workflow in `.github/workflows/pages.yml` deploys the repository to GitHub Pages on pushes to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** if it is not already selected.