# Hugo Correia — 3D Portfolio

An interactive portfolio where a **moliceiro** sails the Ria de Aveiro. Each
pier is a chapter of the CV.

## Two maps

The toggle at the top switches worlds (the boat re-sails the intro on switch):

- **Ilha** — an imagined island loop in the ria.
- **Aveiro** — the real canal network, baked from OpenStreetMap (© OSM
  contributors, ODbL): Canal do Côjo to the Fonte Nova lake, Canal de São
  Roque with its salt warehouses, Canal das Pirâmides past the Marinha da
  Troncalhada out into the ria, Canal do Paraíso and Canal dos Moliceiros.
  Ports and bridges are anchored to real OSM coordinates (Praça do Peixe,
  Museu Arte Nova, Troncalhada, Fonte Nova, Ponte da Dobadoura, the
  Praça Humberto Delgado). Free sailing is constrained to the channels;
  autopilot routes through the canal graph (Dijkstra) — see `lib/aveiro.ts`.

### Regenerating / hand-tuning the canal map

```bash
node scripts/fetch-aveiro-canals.mjs   # re-bake from OpenStreetMap
```

To override with your own geometry: draw LineStrings on https://geojson.io
(over the real map of Aveiro), save as `data/aveiro-canals.geojson`, and
re-run the script — it prefers the local file over OSM. Quays, houses,
bridges, ports and routing all regenerate from whatever centrelines you
provide.

## Controls

- **WASD / arrows** — take the helm and sail freely (momentum, rudder,
  collisions with islands, piers and bridge abutments)
- **Virtual joystick** — appears bottom-left on touch devices (force it with
  `?joystick=1` for testing); analog thrust and rudder, second thumb drags to
  orbit the camera
- **Mouse drag** — orbit the camera around the boat (it eases back behind the
  boat once you're underway) · **wheel** — zoom
- **E / Enter** — dock when alongside a pier
- **Click a pier or a dock pill (or keys 1–6)** — autopilot: the boat finds
  the canal again and sails there on its own; arriving opens that chapter
- **Esc** — close the panel

| Port | Landmark | Section |
| --- | --- | --- |
| 01 Cais da Ria | Canal houses | About Me |
| 02 Cais do Rossio | Art Nouveau facades | Experience |
| 03 Cais da Costa Nova | Striped *palheiros* | Projects |
| 04 Cais das Salinas | Salt pyramids | Skills |
| 05 Cais da Universidade | UA brick buildings | Education |
| 06 Cais do Farol | Farol da Barra lighthouse | Contact |

## Stack

Next.js (App Router) · React Three Fiber + drei · Tailwind CSS v4 ·
TypeScript. The whole city is procedural low-poly geometry — no model files
needed to run.

```bash
npm install
npm run dev
```

## Using the real moliceiro model

The boat is procedural by default. To swap in the Sketchfab model
["Moliceiro Aveiro" by André Bernardo](https://sketchfab.com/3d-models/moliceiro-aveiro-6661978e2edb4749addeb41c2ffaedec):

1. Log in to Sketchfab → **Download 3D Model** → **glTF (.glb)** (only
   possible if the author enabled downloads — the embed snippet alone does
   not include the mesh).
2. Save it as `public/models/moliceiro.glb`.
3. Reload — the app detects the file and swaps the boat automatically.
   If it sits oddly, tweak `GLB_TUNE` in `components/three/Moliceiro.tsx`.

The attribution line required by CC-BY is already rendered in the bottom-right
corner of the page.

## Optional scenery models (3D credits)

Sketchfab embeds are sealed viewers — they can't be placed inside the scene.
To stand these models in the world, download each (Sketchfab login →
**Download 3D Model** → glTF `.glb`, if the author enabled downloads) and save
with the exact filename below in `public/models/`. Missing files are skipped
silently; downloaded ones appear on next reload.

| File | Model · author | Where it appears |
| --- | --- | --- |
| `moliceiro.glb` | [Moliceiro](https://skfb.ly/ouOAW) · ricardo.turmas · CC BY-NC-SA 4.0 | the boats — **✓ installed** |
| `igreja-barrocas.glb` | [Igreja das Barrocas](https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4) · ricardo.turmas | town-island centrepiece + Aveiro — **✓ installed** |
| `ponte-carcavelos.glb` | [Ponte de Carcavelos](https://sketchfab.com/3d-models/ponte-de-carcavelos-aveiro-4a504e3b7df541f0a2f489aed2b7d63c) · ricardo.turmas | every bridge on both maps, with ribbons (ponte do laço) — **✓ installed** |
| `igreja-trofa.glb` | [Igreja da Trofa](https://sketchfab.com/3d-models/igreja-da-trofa-jacinta-c9a65f6a206344cd8c51461ca7a260c1) · ricardo.turmas | island map, replaces the chapel (optional) |

Positions/sizes live in `lib/placedModels.ts`. To add another model, drop its
`.glb` in `public/models/` and add a registry entry (file, position, rotY,
size, optional `yOffset`/`islet`).

Most Sketchfab models are CC-BY: keep this table (linked from the page footer)
up to date as the visible attribution. Placements/sizes live in
`lib/placedModels.ts`.

## Content

All CV content lives in `data/profile.ts`; the route/ports layout in
`lib/ports.ts`. The downloadable CV is served from `public/cv/`.

## Deploy

```bash
vercel deploy
```
