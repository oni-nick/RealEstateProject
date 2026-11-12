# PLOT OS v2 UI run (real-service look, real map, example photos)

Approved by Nick in chat (t28s1: "이 플랜으로 러너 시작해줘"). Local commits only. No push/merge/deploy.

- Worktree: C:\Users\nicho\Dev\RealEstate-v2  branch demo/plot-os-v2  start HEAD 3ef6b0f
- Runner folder: C:\Users\nicho\Dev\RealEstate-v2-ui-run

| step | name | sandbox | cap (min) |
|---|---|---|---|
| 00 | analysis-readonly | read-only | 20 |
| 01 | design-guide | workspace-write | 60 |
| 02 | example-photos | workspace-write | 40 |
| 03 | openfreemap-map | workspace-write | 80 |
| 04 | ui-restyle | workspace-write | 80 |
| 05 | verify-preview-summary | workspace-write | 40 |

Total cap ~5h20m (caps, not fixed length).

In scope: docs/DESIGN_GUIDE.md (ValueMap-like real-service patterns, no copied assets); MapLibre GL JS (CDN) + OpenFreeMap basemap with name:ko labels, markers, clusters, click-through, photo popup, OSM/OpenFreeMap attribution; example building photo pool (labeled 예시, not real listings, each file < 1MB); restyle all core scenes.
Out of scope: GitHub Pages, push, merge, CSV/DB, public data APIs, Kakao/Naver, slider->proposal bug, npm/React/Vite.
Binary photos are NOT committed (Nick rule: no binaries); they stay in the worktree, plus a committed text generator/manifest.