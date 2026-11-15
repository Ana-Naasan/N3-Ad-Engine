Third-party media for the Gojo domain branch. Downloaded on 2026-11-15 (from YouTube unless a section says otherwise); not ours.

The four media files are in the repo next to this file, so a fresh clone has the domain on.
The domain turns itself off if `ads.mp4`, `voice.m4a`, `teleport.m4a` or `gojo.glb` is missing
from `public/domain/`. `?domain=0` turns the domain off.

## `ads.mp4` (1920x720, six 640x360 cells, row-major, 30 s)

| Cell | Brand | YouTube URL | Video title | Channel | Seconds used |
| --- | --- | --- | --- | --- | --- |
| 1 (top left) | HeadOn | https://www.youtube.com/watch?v=f_SwD7RveNE | HEADON! Apply directly to the forehead! | KyleLC (not the brand's upload) | 0–30 |
| 2 (top middle) | Kars4Kids | https://www.youtube.com/watch?v=K8UV7SAhvG4 | Kars4Kids Official TV Commercial (Kars for Kids Video Jingle) | Kars4Kids | 0–30 |
| 3 (top right) | J.G. Wentworth | https://www.youtube.com/watch?v=pdPM6j1Q4sg | J.G. Wentworth Commercial - Viking Opera | JG Wentworth | 30–60 |
| 4 (bottom left) | OxiClean (Billy Mays) | https://www.youtube.com/watch?v=2PU8ZxQj7eE | Billy Mays OxiClean™ Versatile Stain Remover Commercial | OxiClean | 30–60 |
| 5 (bottom middle) | Flex Tape (Phil Swift) | https://www.youtube.com/watch?v=0xzN6FM5x_E | Flex TAPE® Commercial (2017) -- Phil Swift | Flex Seal | 69–99 |
| 6 (bottom right) | Liberty Mutual (LiMu Emu) | https://www.youtube.com/watch?v=_4zAN9BfBGQ | Streaker \| LiMu Emu & Doug \| Liberty Mutual Insurance Commercial | Liberty Mutual | 0–30 |

For the three longer ads the 30 s window is the loudest one in the upload. Black borders
baked into the HeadOn and J.G. Wentworth uploads were cropped off before scaling. The audio is
all six ads mixed, each gain-matched to -17.5 LUFS first, then limited.

## Voice clips

| File | Line | YouTube URL | Video title | Channel | Seconds cut |
| --- | --- | --- | --- | --- | --- |
| `voice.m4a` | "Domain Expansion: Infinite Void" (English dub) | https://www.youtube.com/watch?v=pvpcfzTwcqg | Gojo uses Domain Expansion English Dub (Jujutsu Kaisen) | Dark Tobi | 34.08–37.80 |
| `teleport.m4a` | Instant-transmission sound effect (no speech) | https://www.youtube.com/watch?v=yhb8J3PzEaE | Dragon Ball Z- Goku Instant Transmission | Opulent Sound FX | 0.88–2.38 (+5 dB, limited) |

## `gojo.glb` (the model)

"SATORU GOJO (SHINJUKU battle version) || JJK" by shamus (https://sketchfab.com/consistent_models),
licensed CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).
Source: https://sketchfab.com/3d-models/satoru-gojo-shinjuku-battle-version-jjk-afb43273284848f79637f1bf71b9b361
The file was fetched from the copy in the GitHub repo Shin2930/Design_my_room, not from Sketchfab.
Changes here: none to the file. At load the code resets it to its bind pose, hides the two
orbs in its hands and poses it (src/features/domain/gojo.js).
