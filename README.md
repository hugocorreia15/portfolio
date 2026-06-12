# Hugo Correia — 3D Portfolio

An interactive portfolio where a **moliceiro** sails the Ria de Aveiro. Each
pier is a chapter of the CV.

## Two maps

The toggle at the top switches worlds (the boat re-sails the intro on switch):

- **Ilha** — an imagined island loop in the ria.
- **Aveiro** — a stylized but geographically faithful model of the real canal
  network: Canal Central, Canal do Cojo ending in the Fonte Nova lake, Canal
  de São Roque with its salt warehouses and the Ponte de Carcassonne, the
  Canal dos Botirões ring around the Beira-Mar quarter, and the Canal das
  Pirâmides opening into the open ria toward Costa Nova and the Farol da
  Barra. Ports sit at their real locations (Praça do Peixe, Rossio,
  Troncalhada salinas, Fonte Nova). Free sailing is constrained to the
  channels; the autopilot routes through the canal graph (Dijkstra) —
  see `lib/aveiro.ts`.

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

## Content

All CV content lives in `data/profile.ts`; the route/ports layout in
`lib/ports.ts`. The downloadable CV is served from `public/cv/`.

## Deploy

```bash
vercel deploy
```
