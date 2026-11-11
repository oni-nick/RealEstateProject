# Step 4 — App shell, design system and schematic map

**예시 데이터 · 실제 매물 아님.** This is a static, zero-dependency demo using the
existing synthetic JSON and calculation engine. All text assets are UTF-8 without BOM.

## Entry and routes

- Serve `web-v2/` over HTTP. Native modules and relative JSON fetches require HTTP;
  opening `index.html` as `file://` is unsupported and has an explanatory message.
- No external network resources, map tiles, fonts, installations or build are needed.
  Local HTTP serving works without external internet. A downloaded hosted page is
  not a persistent offline app: no service worker/cache installation is included.
- `#/` is the landing view, with the Korean tagline and three value points.
- `#/radar` shows shared filters, KPIs, all 400 dots, and up to 24 candidate cards.
- `#/listings` shows all filtered candidates with sorting and 20-row pagination.
- `#/building/<id>` loads a detail file only when `deepPath` exists, otherwise shows
  the available summary. NOI, cap rate, equity, IRR and DSCR use the Step 3 engine.
- `#/proposal` shows a three-building picker until a building has been selected;
  afterwards it uses the session selection. `#/building/<id>/proposal?for=buyer|seller`
  is a direct link to an explicitly labeled building-summary proposal.
- Proposal printing calls `window.print()`. A4 CSS hides shell controls, retains
  the example-data disclaimer and includes table/header/break conventions. Final
  browser print pagination is not visually verified in this environment.
- Bid/value-up paths are parsed for future extension but render an explicit
  unavailable-page state. Full pricing, investor scoring, interventions and full
  proposal/evidence appendices belong to subsequent steps. Pipeline is omitted.

## Modules and extension points

- `js/app.js`: core loading, shell initialization, hash-router mounting, stale
  asynchronous render protection, page titles, nav selection, evidence mode,
  evidence panels, loading/error/retry states and route cleanup.
- `js/router.js`: pure `parseRoute(hash)` and disposable `createRouter(callback)`.
  Links and assets work beneath a deployment subpath; no root-relative app URLs.
- `js/store.js`: session-only `createStore`, `store`, `updateFilters`,
  `DEFAULT_FILTERS`, and pure `filterBuildings`. No persistent customer data.
  Search/region/maximum ask/walk/deep-only conditions are shared across views;
  completed references remain on the map, dimmed, and are excluded from candidates.
- `js/data.js`: `createDataLoader`, `loadCore`, `load`, `loadDeep`; fetches are
  deduplicated/cached, failures are evicted for retry, paths are allowlisted and
  deep-record ids are validated. All data URLs resolve relative to the module.
- `js/views.js`: landing, radar, listings, overview and summary-proposal views.
  Views return `{element, destroy?, selectId?}`. Call `destroy` before unmounting;
  only the current mounted view may update the selected building.
- `js/ui/components.js`: DOM helper, KPI card, chip, slider with formatted output,
  semantic table, badge, modal side panel, toast, empty state, evidence number and
  buttons. Text is inserted as text nodes, without HTML interpolation.
- `js/ui/format.js`: Korean numeric formatters and median; null is never zero.
- `css/tokens.css`, `layout.css`, `components.css`, `print.css`: navy shell/light
  cards/teal accent; system Korean fonts, tabular figures, desktop layouts,
  narrow-screen breakpoints, sticky example badge, focus and reduced-motion rules.

## Map contract

`createSeoulMap({geography, buildings, onOpen, onHover, compact})` returns
`{element, update, highlight, getViewBox, destroy}`. `update` accepts a Set of
`matchingIds`, an `activeDistricts` array and an optional `selected` id. Callbacks
carry building ids, not coordinates or real parcel identifiers.

`createProjection` derives a uniform projection from supplied district/river
extents. All gu polygons, river points, dots and labels use that projection.
The map declares that its boundaries, building positions and walk times are
schematic. Hover/focus reveals the same tooltip; click/Enter opens the building.
Pointer drag and arrow keys pan; wheel/buttons/plus/minus zoom; reset/0 restores
the full view. ViewBox bounds clamp to 1–5× magnification. Dots use roving keyboard
focus, with arrow keys cycling buildings. The legend distinguishes matching,
dimmed/completed and deep-data buildings. `destroy` aborts the map's event listeners.

## Verification and limits

- Full in-process suite: 69 passed, 0 failed, including 12 smoke tests. Tests parse
  all 32 JSON files, import every module, check HTML/import paths, encoding/size,
  routes/history cleanup, store/filter behavior, fetch cache/retries/detail ids,
  all map coordinates, viewBox clamps/anchor math and missing-value formatting.
- A minimal DOM fixture constructs all five views with the real synthetic data,
  checks 400 dots/10 polygons, empty/reset filters, candidate cards, detail rent
  roll, proposal picker/audience and map activation/listener teardown. It does
  not substitute for a browser or verify layout, native pointer input or printing.
- A temporary loopback server under `/demo/` returned all 53 HTML/CSS/JS/JSON
  assets with HTTP 200 and byte-identical content; JSON and JavaScript MIME were
  checked. The server was stopped and the listening port was checked clear.
- Exact requested isolated `node --test tests/` remains blocked by `spawn EPERM`.
  Use the documented explicit-file in-process command in `docs/PROGRESS.md`.
- Browser access host was unavailable. Computer Use then stopped because it
  could not confidently determine the current browser URL for policy enforcement.
  No demo screenshot, actual browser rendering, browser console, physical
  pan/zoom, viewport layout or print-preview verification is claimed.
- All underlying market/lease/lender/tax/condition data remains unverified or
  UNKNOWN. Summary proposals do not provide a buy recommendation or valuation.
