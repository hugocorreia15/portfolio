# Moliceiro 3D model

The scene uses a built-in stylized moliceiro by default. To use the real
Sketchfab model instead:

1. Open https://sketchfab.com/3d-models/moliceiro-aveiro-6661978e2edb4749addeb41c2ffaedec
   ("Moliceiro Aveiro" by André Bernardo — @andereberna).
2. If the author allows downloads: Download 3D Model → glTF (.glb).
3. Save it here as `moliceiro.glb` (i.e. `public/models/moliceiro.glb`).

The app detects the file automatically and swaps the boat — no code changes
needed. If it sits oddly, tweak `GLB_TUNE` at the top of
`components/three/Moliceiro.tsx`.

⚠️ Most Sketchfab models are CC-BY licensed: keep the attribution
"Moliceiro Aveiro by André Bernardo on Sketchfab" visible on the site
(there is a ready-made credit line in the Contact panel — see README).
