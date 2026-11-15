# Getting Meta's look without Unity

Researched 2026-11-15. Started 11:44:06 EST, finished 12:07:53 EST, both read from `date`.

Method: I read the IWSDK, pmndrs/uikit, Project Flowerbed, Godot plugin and three.js repos through the GitHub API, and Meta's developer docs through a web fetch. I looked at three still images. I ran nothing in a headset, watched no video and downloaded no asset. This file builds on `quest-non-unity-stack.md` and does not repeat it.

## Verdict

Yes, the web route can reach the look Bader wants. IWSDK's default UI kit is a port of Meta's own Horizon OS UI Set, its controllers are the real Quest Touch models, and Meta's IWSDK rebuild of Project Flowerbed is a full game that its README says holds 72 fps on Quest 3. The engine does not supply the rest. The build needs one consistent asset set, image-based lighting from an HDR, contact shadows, and no post-processing pass. I found no first-party WebXR sword-fighting showcase, so the combat itself is unproven on the web.

## 1. What IWSDK looks like

### UI

- The UI system is pmndrs/uikit. It draws panels as real three.js geometry with Yoga flexbox layout, MSDF text and instanced panels. https://iwsdk.dev/concepts/spatial-ui/uikit
- You write the UI in `.uikitml` files, an HTML and CSS style markup that IWSDK loads at runtime. https://iwsdk.dev/guides/10-spatial-ui-uikitml
- IWSDK has a Horizon OS styled component kit and it is the default. The guide says "IWSDK's default `horizon` kit includes Horizon components and Lucide icons". The other kit is named `default`. https://iwsdk.dev/guides/10-spatial-ui-uikitml
- The `horizon` kit is `@pmndrs/uikit-horizon`. Its README says it is "based on the Reality Labs Design System (RLDS)" and links Meta's Figma file "Meta Horizon OS UI Set". https://github.com/pmndrs/uikit/blob/main/packages/kits/horizon/react/README.md
- The kit's license file carries "Copyright (c) 2025 Meta Platforms LLC" under MIT. https://github.com/pmndrs/uikit/blob/main/packages/kits/horizon/core/LICENSE
- Components in the kit are Avatar, Badge, Button, Checkbox, Divider, Dropdown, IconIndicator, Input, InputField, Panel, Progress, RadioGroup, Slider and Toggle. https://pmndrs.github.io/uikit/docs/horizon-kit/panel
- Meta's native "Meta Horizon OS UI Set" docs link the same Figma file. The web kit and Meta's native kit come from one design source. https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-ui-overview/ and https://www.figma.com/community/file/1509641173090552632/meta-horizon-os-ui-set
- Screenshot of every Horizon kit component: https://github.com/pmndrs/uikit/blob/main/docs/getting-started/horizon-overview.png. I looked at it. It shows a dark rounded panel with pill buttons, toggles, radio buttons, sliders and a dropdown.

### Hands and controllers

- IWSDK creates the visuals for you when an input source appears. Controllers use `AnimatedController` and hands use `AnimatedHand` by default. https://iwsdk.dev/concepts/xr-input/input-visuals
- Controllers are Meta's own models. The adapter reads the connected controller's WebXR input profile and loads `<profileId>/<left|right>.glb` from the `@webxr-input-profiles/assets@1.0` package on jsDelivr. https://github.com/meta/immersive-web-sdk/blob/main/packages/xr-input/src/gamepad/input-profiles.ts
- That package has GLBs for `meta-quest-touch-plus`, `meta-quest-touch-plus-v2`, `meta-quest-touch-pro` and `oculus-touch-v3`. https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/profilesList.json
- The package README says the assets are MIT, and that the license does not cover the device makers' trademarks. https://github.com/immersive-web/webxr-input-profiles/blob/main/packages/assets/README.md
- `AnimatedController` moves the buttons and sticks from live input. https://iwsdk.dev/concepts/xr-input/input-visuals
- Hands are not Meta's system hand model. `AnimatedHand` loads the `generic-hand` GLB from the same package, then replaces its material with a stencil pass and a white outline shader that fades toward the wrist. The player sees outlined hands. https://github.com/meta/immersive-web-sdk/blob/main/packages/xr-input/src/visual/impl/animated-hand.ts
- `AnimatedControllerHand` is a third option. It shows a hand that holds the controller and blends toward a pressed pose from button values. https://iwsdk.dev/concepts/xr-input/input-visuals
- You can swap in your own GLB with `updateVisualImplementation`. Project Flowerbed does this for "rigged glove hands and grip poses". https://github.com/meta-quest/ProjectFlowerbed#what-it-demonstrates

### Lighting and renderer defaults

- IWSDK uses image-based lighting as its main lighting. `IBLTexture` takes an HDR file, `IBLGradient` takes colours, and `DomeGradient` or `DomeTexture` draws the sky. https://iwsdk.dev/guides/05-environment-lighting
- `ContactShadow` puts a soft blob under an object for the cost of one transparent quad, with no lights or shadow maps. `ShadowCatcher` receives real shadows on an invisible plane. https://iwsdk.dev/guides/05-environment-lighting
- IWSDK creates its renderer with `antialias: true` and `multiviewStereo: true`. https://github.com/meta/immersive-web-sdk/blob/main/packages/core/src/init/world-initializer.ts#L479-L484

### Where to see it

- Starter scene poster frame: https://iwsdk.dev/testing-experience/starter-iwer-poster.jpg. I looked at it. It shows a dark rounded panel titled "Hello, Immersive Web!" with a white pill button, two white Quest Touch Plus controllers, a robot, a plant and a pale ring-shaped room.
- Starter scene recorded in a headset: https://iwsdk.dev/testing-experience/starter-vr.mp4. The server returns a 37 MB MP4. I did not watch it.
- Live examples that run in a desktop browser through the emulator: https://iwsdk.dev/examples/#grab and https://iwsdk.dev/examples/#physics
- Grab example GIF: https://github.com/meta/immersive-web-sdk/blob/main/docs/assets/grab/grabvr.gif
- Project Flowerbed, covered in section 2, is the best picture of a finished IWSDK game.

## 2. Proof that a web page can do this

### Project Flowerbed 2.0, by Meta, on IWSDK

- Live: https://meta-quest.github.io/ProjectFlowerbed/. The README prints the link in lower case, `https://meta-quest.github.io/project-flowerbed/`, and that address returned 404 when I checked. The capitalised path returned 200.
- Stack: `@iwsdk/core` 1.1.0-rc.2, `@pmndrs/uikit-horizon`, `three` aliased to `super-three@0.185.0`. https://github.com/meta-quest/ProjectFlowerbed/blob/main/package.json
- The README calls it "an IWSDK showcase" and says it runs in Meta Quest Browser on Quest 3, 3S and Pro with hands or controllers. https://github.com/meta-quest/ProjectFlowerbed#try-it
- The README claims "A steady 72 fps on Quest 3 at 1.25× resolution" from merged static meshes and prop instancing. https://github.com/meta-quest/ProjectFlowerbed#what-it-demonstrates
- Held objects: a watering can, seed packets and a camera. The README says a hand that holds a prop "grips it in a fixed pose, as a controller does". It has no combat. https://github.com/meta-quest/ProjectFlowerbed#how-it-plays
- Preview image: https://meta-quest.github.io/ProjectFlowerbed/og-image.jpg. I looked at it. It shows a stylised island at sunset, a gloved hand that holds a printed photo, and Horizon style "Keep" and "Discard" pill buttons.
- Meta's blog says the team rebuilt it "from scratch" with the IWSDK agent workflow in 15 hours, reusing the original art. https://developers.meta.com/vr/blog/accelerate-vr-development-with-ai-and-immersive-web-sdk/
- License: code MIT, art and audio CC BY 4.0. https://github.com/meta-quest/ProjectFlowerbed#license

### Moon Rider, by Supermedium, on A-Frame

- Live: https://moonrider.xyz. Source, MIT: https://github.com/supermedium/moonrider
- The README lists "Classic Mode - Surf and slice along the musical road" and "Punch Mode - Crush the stars", and says it "Supports all browsers and headsets (incl. Quest)". https://github.com/supermedium/moonrider#readme
- This is the closest public example of held blades that hit moving targets. The repo's last push was 2024-05-02.

### Dead Secret Circle Web, by Robot Invader and Wonderland GmbH, on Wonderland Engine

- Live: https://dead-secret.wonderland.dev/
- The press release calls it the "first ever WebXR conversion of a native Meta Quest game" and says the team rebuilt it in Wonderland Engine with no Unity dependency. https://www.prnewswire.com/news-releases/wonderland-and-robot-invader-release-first-ever-webxr-conversion-of-a-native-meta-quest-game-dead-secret-circle-301962558.html
- Robot Invader's COO is quoted: "The Wonderland team has faithfully recreated DEAD SECRET CIRCLE, and in some places improved upon what we were able to accomplish with Unity." Same URL.
- It is a horror mystery with no combat. It answers the "shipped Quest game" part of the question, because it is one.

### Smaller examples with a held object and physics

- pmndrs/xr Pingpong. Its `package.json` depends on `@react-three/rapier`. https://pmndrs.github.io/xr/examples/pingpong/ and https://github.com/pmndrs/xr/blob/main/examples/pingpong/package.json
- Needle Engine "Bow & Arrow", described as a VR archery minigame with physics-based arrows. https://needle.tools/samples/bow-&-arrow
- Wonderland Engine "Archery Evolution", a sci-fi VR archery game. https://wonderlandengine.com/showcase/
- "Frosty" by Texelpad on heyVR, a game-jam sword game against snowmen, built with Wonderland Engine. https://heyvr.io/arcade/games/1frosty-1

Gap: none of the first-party showcases I found is a sword fight. Meta's own blog only offers one as a sample prompt, "Build me an RPG-style VR game with neon blocks and a laser sword." https://developers.meta.com/vr/blog/accelerate-vr-development-with-ai-and-immersive-web-sdk/

## 3. Native options and the look

### Meta Spatial SDK

- It is Kotlin. It supports "rich panels within your scene built using your preferred 2D UI framework", glTF, PBR, image-based lighting, skeletal animation and rigid body physics. https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-explainer/
- It gives Meta's panel style out of the box through the Meta Horizon OS UI Set, which the docs call "a collection of essential user interface components designed for immersive experiences" that use "the latest design standards from Meta Horizon OS". https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-ui-overview/
- Components are buttons, cards, checkbox, radio button, switch, dialogs, dropdowns, text field, search bar, side navigation item, sliders and tooltips. Same URL. Sample app: https://github.com/meta-quest/Meta-Spatial-SDK-Samples/tree/main/UISetSample
- That kit has a successor, the Meta VR UI Set SDK, "a Jetpack Compose design system for apps on Meta VR devices". Its example pins the BOM `com.meta.metavrx:metavrx-bom` to `1.2026.0.0`. Page updated 2026-09-28. https://developers.meta.com/vr/documentation/android-apps/meta-vr-ui-set-sdk/
- Hands and controllers: `AvatarSystem` "handles the visibility of the controllers and hands", and "By default, we show the hands wrapping around the controllers." https://developers.meta.com/vr/reference/spatial-sdk/v0.7.0/root/com.meta.spatial.toolkit/avatar-system/
- Cost on this Mac, from the earlier file: Android Studio, the Android SDK and Meta Spatial Editor are not installed, and the output is an APK to sideload.

### Godot with the OpenXR vendors plugin 5.2.0

- Controllers: the `OpenXRFbRenderModel` node "Uses the XR_FB_render_model extension to show the controllers for the headset that is currently in use". The model arrives from the headset's OpenXR runtime as glTF, so it is Meta's own controller model. https://godotvr.github.io/godot_openxr_vendors/api/class_openxrfbrendermodel.html
- Hands: `OpenXRFbHandTrackingMesh` is "A skinned mesh representing the player's hand", fetched from the runtime through `XR_FB_hand_tracking_mesh`. It has a `material` property for restyling. https://github.com/GodotVR/godot_openxr_vendors/blob/master/docs/manual/meta/hand_tracking.rst
- UI: Godot does not give Meta's panel style. The plugin's Meta manual covers application space warp, color space, composition layers, dynamic resolution, environment depth, hand tracking, passthrough, scene manager and spatial anchors, and no UI kit. https://github.com/GodotVR/godot_openxr_vendors/blob/master/docs/manual/meta/index.rst
- The plugin's demo draws UI with a `viewport_2d_in_3d` helper, which puts ordinary Godot Control nodes on a quad. You would theme those by hand to look like Meta's panels. https://github.com/GodotVR/godot_openxr_vendors/tree/master/demo/addons/common/viewport_2d_in_3d
- The Godot Meta Toolkit covers the Platform SDK, APK extensions and the XR simulator, and no UI kit. Latest release 1.0.3-stable, 2025-07-29. https://github.com/godot-sdk-integrations/godot-meta-toolkit

### Comparison

| | Meta panel style by default | Controller models | Hand visuals |
|---|---|---|---|
| IWSDK | Yes, `horizon` kit from Meta's Figma set | Quest Touch GLBs from the W3C input-profiles package | Outlined generic hand, swappable |
| Meta Spatial SDK | Yes, Meta's own Compose UI Set | Shown by `AvatarSystem` | Hands wrapped around controllers by default |
| Godot + vendors plugin | No | Meta's model from the runtime | Meta's hand mesh from the runtime |

## 4. Rendering limits in the Quest Browser

### What Meta's WebXR docs state

- Frame rate. A WebXR session "runs by default at 90 frames per second on Meta Quest 2 and 72 frames per second on Meta Quest headsets". `session.supportedFrameRates` lists the options and `session.updateTargetFrameRate(rate)` changes the target. https://developers.meta.com/horizon/documentation/web/webxr-frames/
- Frame budget. 13.7 ms per frame at 72 FPS and 11.1 ms at 90 FPS. "Any app logic that takes longer than two milliseconds should be considered for optimization." Page updated 2026-07-21. https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/
- Triangle and draw-call budgets. Meta's WebXR pages give no numbers. The only figure is a warning that 1000 single-triangle draw calls would likely drop an app below 72 FPS from CPU cost. https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/
- PBR materials. three.js supports them, and Meta says to use them sparingly. With heavy PBR use, limit the scene to "one directional light or one point light". For static lighting, consider light probes or baked lightmaps. https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/
- Cheaper materials. Meta suggests `MeshPhongMaterial` instead of `MeshStandardMaterial` where the visual impact is low. https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/
- Shadows. A real-time shadow needs an extra scene render from the light's view and "counts against your overall scene budget for draw calls and triangles". Shadow-casting point lights "usually have 6 shadow maps that need to be rendered each frame". https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/
- Textures. "KTX 2.0/Basis Universal is the recommended approach to texture-compression for WebXR experiences on Meta Quest devices." https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/
- Antialiasing. The performance pages I read give no MSAA setting. The multiview page says `OCULUS_multiview` "includes support for multisampled antialiasing (MSAA)". https://developers.meta.com/horizon/documentation/web/web-multiview/
- Multiview. "Often, a CPU usage reduction of 25% - 50% is possible", and "Only CPU-bound experiences will benefit". It needs WebGL 2 and Meta labels it experimental. Same URL.
- Fixed foveated rendering. Request `'high-fixed-foveation-level'`, `'medium-fixed-foveation-level'` or `'low-fixed-foveation-level'` at session start, or set `XRWebGLLayer.fixedFoveation` from 0 to 1. Meta warns that "high-contrast or text-heavy scenes may make the foveation artifacts more obvious". https://developers.meta.com/horizon/documentation/web/webxr-ffr/
- Post-processing. "FFR only applies when rendering to the final frame buffer", and switching render targets during the frame can disable both FFR and MSAA. Same URL.
- Resolution. "Setting the framebuffer resolution to 0.8 or 0.9 will result in a substantial reduction in fragments". Meta treats this as a last resort. https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/
- Overdraw. Sort opaque objects front to back, and stop drawing transparent objects once they have faded out. https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/

### What separates a shipped look from a tech demo

This list is my reading of the sources. No source states it as a rule.

1. One art style across every asset. Flowerbed uses a single stylised set made for it. https://github.com/meta-quest/ProjectFlowerbed#readme
2. Lighting from an HDR environment map plus at most one direct light, with contact shadows under objects. https://iwsdk.dev/guides/05-environment-lighting
3. A sky and a floor that meet. IWSDK's `DomeFade` blends a floor into the `DomeGradient` sky. https://iwsdk.dev/guides/05-environment-lighting
4. Merged static meshes and instanced props, which is how Flowerbed holds 72 fps. https://github.com/meta-quest/ProjectFlowerbed#what-it-demonstrates
5. No bloom pass. A post-processing chain costs FFR and MSAA, per the FFR page. For a laser sword, I would use an emissive material and an additive glow sprite. That choice is my inference from the FFR page.
6. Hands or gloves that grip the weapon in a fixed pose. https://github.com/meta-quest/ProjectFlowerbed#how-it-plays
7. UI from the Horizon kit, with no hand-drawn panels. https://iwsdk.dev/guides/10-spatial-ui-uikitml
8. Compressed textures in KTX2 and geometry in meshopt. Flowerbed's 2022 case study describes both. https://developers.meta.com/horizon/blog/project-flowerbed-a-webxr-case-study/

## 5. Asset sources

| Need | Source | Format | License | Account |
|---|---|---|---|---|
| Bot with walk and attack | three.js `RobotExpressive.glb` | GLB, 464 KB | CC0 1.0 | No |
| Bot in Meta's style, static | `@iwsdk/example-assets` robot | glTF | MIT, Meta-authored | No |
| Sword, hammer | Poly Pizza | GLB and FBX | CC0 or CC-BY, shown per model | No, on the page I checked |
| Sword, hammer, shields | Quaternius Modular Weapons Pack | FBX, OBJ, Blend | CC0 | Not stated |
| Characters with weapons | KayKit Adventurers | FBX, GLTF | CC0 | Not stated |
| Melee animations | KayKit Character Animations | Not confirmed | Free for personal and commercial use | Not stated |
| Melee animations | Quaternius Universal Animation Library 2 | FBX, GLB, glTF | CC0 | Not stated, download is on itch.io |
| Arena | Kenney Mini Arena | Not listed on the page | CC0 | Not stated |
| HDR lighting | Poly Haven | Not confirmed | CC0 | Not stated |
| Anything specific | Sketchfab | glTF, GLB, USDZ | Creative Commons, per model | Yes |
| Animations for a custom rig | Mixamo | Not confirmed | Royalty free, see notes | Adobe ID |

Notes and sources per row:

- three.js RobotExpressive. The README says "Model by Tomás Laulhé", "CC0 1.0", with changes by Don McCurdy. https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
- Its clips are Idle, Walking, Running, Dance, Death, Sitting, Standing, Jump, Yes, No, Wave, Punch and ThumbsUp. Preview at https://threejs.org/examples/#webgl_animation_skinning_morph. Clip names from https://github.com/mrdoob/three.js/blob/dev/examples/webgl_animation_skinning_morph.html
- IWSDK example robot. Meta authored it and ships it under MIT. I read the glTF JSON and it has 0 animations and 0 skins, so it cannot walk or attack as shipped. https://github.com/meta/immersive-web-sdk/blob/main/packages/example-assets/PROVENANCE.md
- Poly Pizza. The home page says "10,700+ free models". The model page I checked, "Sword" by Quaternius, shows "Public Domain (CC0)", offers FBX and GLTF, and exposes the GLB without a login. https://poly.pizza/m/9lLmH8Et4K and https://poly.pizza/search/sword
- Quaternius Modular Weapons Pack. 24 models, described as "swords, daggers, bows, shields, hammers and many more". The page lists no glTF. Poly Pizza hosts Quaternius models as GLB, which avoids a conversion. https://quaternius.com/packs/medievalweapons.html
- Quaternius Universal Animation Library 2. "130+ animations" on a universal humanoid rig, "covering everything from melee and armed combos". https://quaternius.com/packs/universalanimationlibrary2.html
- KayKit Adventurers. "Free for personal and commercial use, no attribution required. (CC0 Licensed)". 5 characters in the free tier and "25+ weapons/accessories" that include swords, shields and axes. https://kaylousberg.itch.io/kaykit-adventurers
- KayKit Character Animations. "161 Humanoid animations", with melee sets for one-handed, two-handed, unarmed, dual wielding and blocking. https://kaylousberg.itch.io/kaykit-character-animations
- Kenney. "all game assets on the asset pages are public domain licensed (CC0)" and "Attribution is not required." https://kenney.nl/support
- Kenney Mini Arena has 20 files, the tags arena, battle and roman, and a character rig added in version 1.1. https://kenney.nl/assets/mini-arena
- Kenney Blaster Kit has 40 files under CC0. https://kenney.nl/assets/blaster-kit
- Poly Haven. "Our assets are all licensed as CC0", and "You do not need to give credit". It offers HDRIs, textures and 3D models. An HDRI from here can feed IWSDK's `IBLTexture`. https://polyhaven.com/license
- Sketchfab. "Downloading models requires users to be authenticated with a Sketchfab account." Downloads come in "glTF, GLB, and USDZ formats" and are "available under Creative Commons licenses. Most models allow commercial use." https://sketchfab.com/developers/download-api
- Sketchfab models marked "editorial" cannot be used for commercial or promotional use. https://sketchfab.com/licenses
- For a public demo video, pick CC0 or CC BY models and credit CC BY authors in the video description. I would skip no-derivatives licenses, because morphing the weapon changes the model. That caution is mine.
- Mixamo. Adobe's FAQ page returned 403 to me. A search result's summary of that FAQ says an Adobe ID gives free access and that characters and animations are royalty free for "personal, commercial, and non-profit projects", video games included. https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- Meta's own libraries. Project Flowerbed's art is CC BY 4.0, but it is a garden island with no weapons or arena. https://github.com/meta-quest/ProjectFlowerbed#license
- I found no Meta web page that offers GLB downloads to web developers.
- Laser sword. I confirmed no ready-made source. A procedural blade is a cylinder with an emissive material on a hilt, and IWSDK ships an agent skill for procedural models named `iwsdk-build-model`. https://github.com/meta/immersive-web-sdk/blob/main/packages/core/agent-guidance/claude/.claude/skills/iwsdk-build-model/SKILL.md

Suggested picks: RobotExpressive for the bot, Quaternius CC0 weapons from Poly Pizza, Kenney Mini Arena or a procedural `DomeGradient` stage for the arena, and a Poly Haven HDRI for lighting. All four are low-poly and stylised, so they sit together.

## Could not verify

Look and feel

- Whether Horizon kit panels match current Horizon OS system panels exactly. I compared one screenshot by eye. Meta's docs say only "the latest design standards from Meta Horizon OS".
- Whether IWSDK's outlined hands match the Quest system hands.
- Everything about how a scene looks in a headset. I based the descriptions on three still images: the starter poster, the Horizon kit overview and the Flowerbed preview.
- The contents of `starter-vr.mp4` and `grabvr.gif`. I confirmed the files exist and did not view them.

Proof examples

- Flowerbed's "72 fps on Quest 3 at 1.25× resolution". The README states it and I measured nothing.
- Whether Moon Rider still runs well in the current Quest Browser. Its README claims Quest support and the repo's last push was 2024-05-02.
- Whether Dead Secret Circle Web runs in the Quest Browser, and at what frame rate. The press release names the Quest Browser as a target and does not say the game runs there.
- Frosty, Archery Evolution and Needle's Bow & Arrow. I read listing pages and search summaries only.
- The pmndrs Pingpong paddle code. I confirmed the Rapier dependency and not how the paddle is held.
- Any first-party WebXR melee or sword showcase. I found none.

Native options

- The current Meta Spatial SDK version, and whether controllers show by default. The `AvatarSystem` page I read is the v0.7.0 reference and states a default for hands only.
- What Meta Spatial Editor's built-in Asset Library and "Meta 3D Asset Library" contain, their license, and whether they export GLB. I saw them in a search summary and did not open the page.
- Whether a third-party Godot addon offers a Horizon styled UI kit. I checked the vendors plugin and the Meta Toolkit only.
- Godot core's newer `OpenXRRenderModel` API. I saw it in a search summary only.

Rendering

- Triangle and draw-call budgets. Meta's WebXR pages I read state none.
- Supported frame rates per headset in the browser, including 120 Hz.
- The MSAA sample count the Quest Browser uses.
- three.js's default foveation level. The only statement is from Flowerbed's 2022 case study, "Three.js has foveation on by default for all WebXR experiences."
- WebGPU support in the Quest Browser. A third-party blog claims it and I did not check.

Assets

- Kenney's file formats. The pack pages I read list none.
- Mixamo's license terms and export formats from a primary source. The FAQ returned 403.
- Whether Quaternius, KayKit, Kenney, Poly Haven and itch.io downloads need an account. The pages show download buttons and do not say.
- KayKit Character Animations and Poly Haven file formats.
- Whether every Poly Pizza model has a GLB and which license each one carries. I checked one model page.
- Mesh quality, scale, and whether any of these rigs and clips load cleanly in IWSDK. I opened no asset file other than IWSDK's robot glTF JSON.
- Whether RobotExpressive's Punch clip reads as an attack in VR.

Carried over from the earlier file

- Whether a sword held with `OneHandGrabbable` registers hits on a dynamic Havok body in IWSDK. This file did not look at it.
