# Step 03 — OpenFreeMap map

Date: 2026-11-12. Implements the supplied Step 03 brief and `docs/DESIGN_GUIDE.md` in the existing worktree, without packages or a build step.

## Implementation plan

- [x] Add `js/map/radar-geo.js` pure coordinate/GeoJSON helpers and Node tests. Preserve existing synthetic coordinates; missing coordinates use a stable ID hash and small jitter around approximate district centers. Unknown districts with missing coordinates are omitted, never invented. Cluster membership must exactly equal matched rows.
- [x] Add `js/map/radar-map.js`: pinned MapLibre 4.7.1 CDN, deferred mount, pre-load updates, Korean symbol labels, clusters/context points, score/price labels, photo popup, selection/hover, resize and teardown. Tests use an injected MapLibre adapter for lifecycle and errors.
- [x] Wire Radar cards and pagination to map selection; preserve detail links and all financial filters. Home keeps its compact schematic preview. Add scoped CSS and narrowly allowlisted CDN shell tests.
- [x] Run all explicit test files with bundled Node and `--test --test-isolation=none`, audit UTF-8 and changed file sizes, attempt HTTP/browser checks, append `docs/PROGRESS.md`.
- Local commit: attempt `git add -A` then `git commit -m "v2-ui step 03 openfreemap map: OK"`; if sandbox-denied, leave text changes to the runner as authorized.

Commit outcome: `git add -A` failed with permission denied creating the linked-worktree index lock; no commit was created. Changes remain for the runner, per the supplied authorization. No escalation or direct main-checkout writes were attempted.

## Decisions and review focus

Positron (`https://tiles.openfreemap.org/styles/positron`) has a muted palette suited to the score overlays. Liberty would add visual competition; retaining a second Radar SVG implementation would add lifecycle complexity. Radar uses a readable inline fallback and retry instead. Match points cluster; nonmatches use a separate small outline layer. Coordinates, scores and photos remain explicitly synthetic examples, unrelated to actual parcels. Attribution remains visible even in fallback.

Check delayed CDN/style loading, empty filters, selection across pages and sorting, rapid route destruction, tile failure after load, and stale cluster promises after filters change. Browser network/WebGL success and exact parcel correspondence remain UNKNOWN until observed.

References: [OpenFreeMap quick start](https://openfreemap.org/quick_start/), [MapLibre cluster example](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/). No downloaded dependencies or real property data.

## Verification and review record

Pure-helper tests and adapter/scene regression tests were observed failing before their implementations. Independent review identified blocking CDN CSS, overlapping layer click actions, and lost keyboard focus. Fixed with asynchronous CSS plus failure/retry handling, a single prioritized feature query per click, and focus restoration. A follow-up caught stylesheet retry completion after route destruction; document-owned readiness now survives scene teardown, with a regression for retry → leave Radar → stylesheet load → return.

Local HTTP served the seven affected runtime assets and an assigned example popup image with 200 responses and correct content types. The first disposable photo probe mistakenly used its Node `file:` URL; corrected the probe to request the corresponding HTTP path. Pinned CDN JS/CSS and Positron HEAD requests returned 200; fetching the style JSON confirmed 19 symbol text layers and an OpenFreeMap glyph endpoint. These shell probes do not establish browser tile or glyph rendering. Browser inventory reported `The browser access host is unavailable`; no native window was operated, no browser screenshots were stored, and WebGL/rendering/mobile/keyboard usability remain UNKNOWN beyond Node fixtures.

Final suite: 14 explicit test files, 119 passed, 0 failed using bundled Node v24.22.1 with `--test --test-isolation=none`. Changed text files passed strict UTF-8/no BOM/no replacement characters/sub-1MB checks; Korean labels were checked using Unicode escapes, and `git diff --check` passed.
