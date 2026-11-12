# PLOT OS UI restyle implementation plan

**Goal:** Apply docs/DESIGN_GUIDE.md to the existing Korean static service.
**Architecture:** Keep native ES modules, the Step 03 map adapter, existing state and financial engines. Share scene navigation and route construction; use existing generated example imagery and a dedicated service stylesheet.
**Spec:** docs/DESIGN_GUIDE.md and docs/context/ui-step00-findings.md; user Step 04 requirements.

## Constraints and decisions

- Work only in this worktree; one local commit, no remote operations or deployment.
- No packages, binaries, secrets, financial logic or generated data changes.
- Preserve example disclosures, map attribution and external-resource failure behavior.
- Use the existing worktree and execute inline. The user opted out of questions and design approval; the supplied guide is the approved visual direction.
- Keep a desktop drawer nonmodal; below 1440px overlay it on the map with an explicit close control. Preserve listing scroll and map instance.
- Existing assets are generated SVG architectural illustrations, not photographs; retain their accurate disclosures.

## Tasks

- [x] Add meaningful route smoke tests against a shared scene dispatcher; cover deep/summary records, buyer/seller and unknown routes. Add drawer selection/close tests and shell search checks, observe failure.
- [x] Restyle shell with Korean navigation, functional global search, account placeholder and shared building scene links. Preserve hash routing.
- [x] Rebuild Radar layout: horizontal condition menus, left dense photo cards, expanding map, selected detail drawer. Keep matching and all controls.
- [x] Apply tokens, readable type, restrained surfaces, KPI/table/control treatment to Home, Listings, overview, Bid, Value-up and Evidence. Add numeric slider input synchronized with existing range controls.
- [x] Add report cover illustration, consistent report hierarchy and A4 print treatment; preserve all proposal content and math.
- [x] Verify explicit full Node suite (125/125), HTTP/UTF-8/size/CSS-variable/contrast audit (113 assets), and diff. Record browser verification as UNKNOWN because browser host was unavailable and Windows URL verification stopped Computer Use. Local commit remains subject to the worktree sandbox; the runner may need to commit.

## Review focus

Check repeated navigation cleanup, missing/summary data, changed filters with an open drawer, map resize/selection and attribution at 1024/1440/1920px, long Korean labels, keyboard focus and print content flow. No CSS-only tests that merely repeat declarations.

## Final review and verification

Independent read-only review found no Critical findings and four Important issues: partial numeric typing, header links after selection, queued/responsive map padding, and small-screen modal behavior. All four were reproduced by failing tests and repaired; the final complete suite passed. The small-screen drawer now uses native showModal/cancel and restores its desktop placement across breakpoints. No findings were deferred.

The initial full-suite failures were the deliberate font allowlist change and an evidence fixture selecting Radar's closed dialog instead of the actual evidence panel. The tests now allow only the exact pinned font/map URLs and select the evidence panel explicitly. Browser rendering and actual native focus/A4 behavior remain unverified.
