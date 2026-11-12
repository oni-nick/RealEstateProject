# PLOT OS v2 - Naver Maps run (plan)

Goal: replace the main map (home + Deal Radar) in web-v2 from MapLibre/OpenFreeMap to
Naver Cloud Maps Dynamic Map (Web JS, new Application Services > Maps product).
OpenFreeMap/MapLibre stays only as a fallback when Naver fails (auth/domain/network).

Worktree: C:\Users\nicho\Dev\RealEstate-v2 (branch demo/plot-os-v2). Local commits only.
Client ID: runtime-only in web-v2/local-naver-config.js (gitignored). Example file is tracked.

| step | name | sandbox | cap (min) |
|---|---|---|---|
| 00 | analysis-readonly | read-only | 20 |
| 01 | naver-map | workspace-write | 80 |
| 02 | tests-preview-summary | workspace-write | 40 |

Rules: no push/merge/deploy/force-push/history rewrite/npm install; no files > 1MB;
no secrets in commits; tests via bundled node --test --test-isolation=none.
Out of scope: GitHub Pages, Kakao, Google, Directions/Geocoding, proposal-state bug, redesign.
