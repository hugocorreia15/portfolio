# Hugo Correia — 3D Portfolio

An interactive portfolio where a **moliceiro** sails the Ria de Aveiro. Each
pier is a chapter of the CV; `/cv` has the same content as a plain, printable
page. Live at **[hfccorreia.me](https://hfccorreia.me)**.

## Two maps

The toggle at the top switches worlds (`?map=aveiro` links straight to the
second one):

- **Ilha** — an imagined island loop in the ria, seven piers around a town
  island.
- **Aveiro** — the real city centre at 0.3 world units per metre, baked from
  OpenStreetMap (© OSM contributors, ODbL): the true outline of the canals and
  the Fonte Nova lake, the Troncalhada salt pans, quay walls, the street map on
  the ground, ~1 900 real building footprints with their storeys, lamps along
  the quays and mapped trees. Costa Nova and the Barra, ~7 km west in reality,
  sit on stylised spits at the edge of the ria. Free sailing is constrained to
  the channels; the autopilot routes through the canal graph (Dijkstra) — see
  `lib/aveiro.ts`.

| # | Section | Ilha | Aveiro | Landmark |
| --- | --- | --- | --- | --- |
| 01 | About | Cais da Ria | Praça do Peixe | canal houses, azulejo |
| 02 | Experience | Cais do Rossio | Cais do Rossio | Art Nouveau row |
| 03 | Publications | Cais da Fábrica | Centro de Congressos | the old ceramics factory |
| 04 | Projects | Cais da Costa Nova | Costa Nova | striped *palheiros* |
| 05 | Skills | Cais das Salinas | Marinha da Troncalhada | salt pans and flamingos |
| 06 | Education | Cais da Universidade | Cais do Côjo | UA brick buildings |
| 07 | Contact | Cais do Farol | Farol da Barra | lighthouse |

Links like `/#publications` open with the boat already moored at that pier.

## Controls

- **WASD / arrows** — take the helm (momentum, rudder, collisions)
- **Virtual joystick** — on touch devices (`?joystick=1` forces it)
- **Mouse drag** — orbit the camera · **wheel** — zoom
- **E / Enter** — dock when alongside a pier
- **Click a pier or a dock pill (or keys 1–7)** — autopilot
- **Esc** — close the panel
- **`?stats`** — FPS overlay, plus draw calls / triangles in the console

## Content

All CV content lives in `data/profile.ts` (the panels and `/cv` both read it);
the PDFs are in `public/cv/`. The island's route and piers are in
`lib/ports.ts`; Aveiro's ports are anchored to real POIs in `lib/aveiro.ts`.

## How the world is built

- **Buildings** (`components/three/buildings.tsx`, `lib/facades.ts`) — one
  shader tiles every wall with facade cells painted on canvas (pastel
  riverside, azulejo, Art Nouveau, salt warehouse, palheiro, brick, modern),
  with a painted relief it marches into (parallax) so windows and doors sit
  back and frames, sills and cornices stand out;
  windows keep their size on any wall, the instance colour tints only the
  plaster and windows light up at random after dusk.
- **Moliceiro** (`components/three/moliceiroModel.tsx`) — a lofted hull with
  the swan-neck bow, painted panels, sail and rudder, built in code; the
  rudder follows the turns and the boatman works his pole. Its wake opens in
  a Kelvin V of foam behind it.
- **Off the map** — sail past the edge of the lagoon (or down a ria channel off
  the Aveiro map) and a shark eats the boat, GTA-style, before it respawns at
  the start (`components/three/shark.tsx`).
- **Night** — lamps register in `lib/lampLights.ts`; the dozen nearest light
  every lit material through a short loop injected into three's shaders (no
  point lights, no recompiles, zero cost by day). The boats' lanterns are
  moving lamps, and the lighthouse sweep lights a wedge of everything it
  crosses the same way. Lit windows glow onto their walls and throw pools of
  light on the pavement. Shared night-driven materials live in
  `lib/nightMaterials.ts`.
- **Sky** — a procedural cloud deck (one dome riding with the camera, lit by
  the sun or the moon) that the water reflects too; the light holds steady
  through sunrise and sunset.
- **Water** — receives the sun's shadows (redrawn every frame, so the boats'
  follow them smoothly) and mirrors the whole scene — islands, houses,
  bridges, boats, lamps — through a low-resolution planar reflection
  (`lib/reflection.ts`) whose detail drops on slow machines.
- **Performance** — the water and sky follow the camera and end where the fog
  does; instanced props and the city are split into cullable cells; the pixel
  ratio adapts to the frame rate.

## Regenerating assets

```bash
npm run models                     # bake public/models from assets-src/models
python3 scripts/bake-aveiro.py     # bake the Aveiro city from OpenStreetMap
python3 scripts/gen-calcada.py     # bake the calçada textures
python3 scripts/gen-clouds.py      # bake the cloud-deck noise
python3 scripts/gen-logo.py        # bake the hfc signature (logo + favicon)
node scripts/fetch-aveiro-canals.mjs   # re-fetch the canal centrelines
```

`bake-aveiro.py` caches Overpass responses in `assets-src/osm/` (git-ignored);
delete them to refresh. It needs Python with `numpy`, `opencv-python` and
`Pillow`.

## 3D credits

The models below are CC BY 4.0 and credited on `/credits` (`data/credits.ts`).
Sources live in `assets-src/models/`; the runtime copies are baked by
`scripts/bake-models.mjs`.

| Model · author | Used for |
| --- | --- |
| [Igreja das Barrocas](https://sketchfab.com/3d-models/igreja-das-barrocas-aveiro-3813b360676244ac89879f6b922e1df4) · ricardo.turmas | the island church |
| [Ponte de Carcavelos](https://sketchfab.com/3d-models/ponte-de-carcavelos-aveiro-4a504e3b7df541f0a2f489aed2b7d63c) · ricardo.turmas | the canal bridges |
| [Old Street Lamp Pack](https://sketchfab.com/3d-models/old-street-lamp-pack-324ff0abd82d4f679f9e64065ad142a3) · Bailey123704 | lampposts by the piers |
| [Low Poly Forest Tree Pack](https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b) · 99.Miles | trees and bushes |

Textures: ambientCG (CC0); the calçada, the facades and the clouds are
generated.

## Stack

Next.js (App Router) · React Three Fiber + drei · Tailwind CSS v4 ·
TypeScript.

```bash
npm install
npm run dev
```
