Read-only survey complete on `demo/plot-os-v2` at `3ef6b0f`. Working tree remains clean; no files modified, installs, or pushes.

**1. File map and routing**

Paths below are relative to `web-v2/`.

| Area | Files and purpose |
|---|---|
| Entry | `index.html`: shared header/navigation, example-data banner, main mount, footer; loads `js/app.js` as a native ES module |
| App infrastructure | `js/app.js`, `router.js`, `store.js`, `data.js`: startup, routing, session state, cached JSON loading |
| Shared scenes | `js/views.js`: Home, Listings, building overview; re-exports Radar and Proposals |
| Scene logic | `js/radar.js`, `bid.js`, `valueup.js`, `proposal.js`, `building-analysis.js`, `evidence-trace.js` |
| Scene UI | `js/ui/radar-view.js`, `bid-view.js`, `valueup-view.js`, `proposal-view.js`, `evidence-panel.js` |
| Shared UI | `js/ui/map.js`, `components.js`, `format.js`, `lease-waterfall.js` |
| Charts | `js/ui/bid-charts.js`, `valueup-charts.js`, `proposal-charts.js` |
| Financial engine | `js/engine/{index,adapters,model,irr,pricing,scenarios,sensitivity,evidence}.js` |
| CSS | `css/tokens.css`, `layout.css`, `components.css`, `proposal.css`, `print.css` |
| Core data | `data/buildings.json`, `districts.json`, `market_refs.json`, `generation.json` |
| Lazy data | `data/comps.json`, `data/deep/bld-*.json`—25 detail files |
| Other | `data/data-sources.md`; ES-module `package.json` files under `js/` and `js/engine/` |

- `router.js` parses hashes: `#/`, `#/radar`, `#/listings`, `#/proposal`, and `#/building/<id>[/bid|valueup|proposal]`; query strings become `URLSearchParams`.
- `app.js` dispatches scene factories, destroys the previous view, replaces main content, updates title/navigation/focus, and rejects stale asynchronous results.
- Evidence is a shared modal, not a route. Filters and selected building live in memory; no persistent storage.
- Serve over HTTP: `app.js` explicitly rejects `file://`.

**2. Current map and MapLibre replacement**

- Exact renderer: [map.js](/C:/Users/nicho/Dev/RealEstate-v2/web-v2/js/ui/map.js:39), `createSeoulMap()`.
- `createProjection()` at line 14 derives geographic bounds from district polygons plus river points, then uniformly scales longitude and inverted latitude into a **900 × 600 SVG**, with 52-unit padding.
- Lines 48–79 construct grid, district `<polygon>` shapes, Han River `<polyline>`, district labels, and one `<circle>` per building. Deep buildings use larger outlined dots.
- Source outlines are handwritten longitude/latitude arrays in [generate-data.mjs](/C:/Users/nicho/Dev/RealEstate-v2/scripts/generate-data.mjs:49), serialized to `districts.json`.
- Custom handlers implement drag, wheel/button zoom, keyboard navigation, tooltips, and activation. `destroy()` aborts listeners.
- Consumers: Home’s compact preview (`views.js:15`) and Deal Radar (`ui/radar-view.js:105`).

**Coordinates already exist:** all **400 buildings have finite `lat`/`lng`**, not stored SVG x/y. Extent: latitude **37.466580–37.591497**, longitude **126.900955–127.143768**.

- Generation at `generate-data.mjs:154` averages district-outline vertices, adds seeded jitter of ±15% of bounding-box width/height, rejects points outside the schematic polygon, and rounds to six decimals.
- Provenance identifies both fields as `a.location`, low confidence. Addresses explicitly describe fictional blocks.
- These coordinates are reusable for an illustrative basemap; actual district/neighborhood/parcel correspondence is **UNKNOWN**. Stations and walking times are independently synthetic.
- If replacing placement later: use documented approximate district centers plus building-ID-seeded jitter; validate against suitable boundaries and label every location “illustrative.” Do not geocode fictional addresses or imply parcel accuracy.

**Filter flow**

- Controls → `updateFilters()` → store subscription → `createRadarMatcher().evaluate()` → `map.update()`.
- `filterBuildings()` applies district, price, use, walking time, query, deep-only, and closed-record exclusion.
- Matcher adds required equity and target IRR at selected LTV; a match must pass every gate. LTV changes debounce for 100 ms.
- `map.update({matchingIds, activeDistricts})` **dims nonmatches; it does not remove them**. Dimmed buildings remain openable.
- Cards and map synchronize hover. “Show outside conditions” changes the list, not map matching.

**Recommended replacement contract**

- Preserve `element`, `update`, `highlight`, `destroy`, `onOpen`, `onHover`, and compact mode; retire SVG projection/viewBox APIs with their tests.
- Convert records to GeoJSON points in **`[lng, lat]` order**, retaining building IDs.
- Use clustered matching points, cluster counts/expansion, and separate dim context points so cluster counts reflect matches. MapLibre documents this cluster/source pattern. [Official example](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/)
- Pin matching CDN JS/CSS versions; use the documented OpenFreeMap style and retain attribution. [OpenFreeMap guide](https://openfreemap.org/quick_start/)
- Add photo popups with an explicit building-detail link; preserve accessible card links and keyboard access.
- Handle initialization after DOM attachment, queued pre-load updates, resizing, async cancellation, and `map.remove()` on scene destruction.
- Update map CSS, captions, legend, Home preview, and print behavior. `data.js:loadCore()` currently requires `geography.river.points`; deleting schematic data also requires changing that validation.

**3. CSS and design**

- Tokens: navy `#111e30`, canvas `#f3f5f7`, white surfaces, ink `#17283b`, muted `#647286`, borders `#e0e6ec`, teal accent `#087e75`, pale teal `#e7f4f1`.
- Radii: 12/7 px; spacing tokens: 4–48 px; subtle shadows; 160 ms transitions.
- Typography: Pretendard → Apple SD Gothic Neo → Malgun Gothic → sans-serif. **No font asset or webfont loading exists**; actual rendered font is **UNKNOWN**.
- Base type is 14 px, headings 28/18/15 px; many labels/captions use 9–12 px. Numerals use tabular spacing.
- `layout.css` defines the three-column Radar workspace and responsive breakpoints; `components.css` contains shared controls, map, Evidence, Bid, and Value-up styling.
- Source-based demo cues: schematic map without street context, no building imagery, repetitive fictional names, text-heavy cards, prominent English workspace labels, and a rotated marketing preview.
- Current browser appearance and comparison against live ValueMap are **UNKNOWN**; no visual session was run. Preserve synthetic-data disclosure during restyling.

**4. Building data and photos**

- Identity/context: `id`, `nameKo`, `districtId`, `neighborhood`, `addressKo`, `useKo`, `zoningKo`, `stationNameKo`, `statusKo`, `sellerMotivationKo`, `deepPath`, `provenance`.
- Physical/location: `landAreaM2`, `gfaM2`, `exclusiveAreaM2`, `floorsAbove`, `floorsBelow`, `builtYear`, `walkMinutes`, `daysOnMarket`, `lat`, `lng`.
- Financial: `askingPriceKrw`, `estimatedValueLowKrw`, `estimatedValueHighKrw`, `capRate`, `occupancy`, `noiAnnualKrw`, `annualRentKrw`, `potentialAnnualRentKrw`, `annualMgmtKrw`, `annualOpexKrw`, `depositKrw`.
- Exactly **40 buildings per district** across ten districts; **25 deep / 375 summary-only**.
- Deep files add `buildingId`, `snapshotDate`, `rentRoll`, `opex`, `capexHistory`, `assumptions`, `comps`, `valueUpNotes`, and metadata.
- Summary-only buildings still support financial scenes through the summary adapter; detailed leases remain explicitly unavailable.
- No photo fields, image components, or photo pool currently exist.
- Attach `photoId` plus a relative `photoUrl` to summary records so cards/popups need no deep fetch. Keep credits, license, source, alt text, and example-image disclosure in a pool manifest.
- Change the generator alongside generated JSON; hand edits fail byte-for-byte regeneration tests. Use a separate deterministic photo assignment so existing financial randomness stays stable.
- A new JSON manifest needs loader allowlisting in `data.js`; a JS manifest avoids that loader change.

**5. Tests**

**Executed:** all **112 tests across 12 files passed**, using bundled Node with `--test --test-isolation=none` and explicit filenames.

| Test file | Main coverage |
|---|---|
| `data.test.mjs` | Counts, schemas, provenance, geometry, accounting, deterministic generation |
| `market-refs.test.mjs` | Reference bands, units, UNKNOWNs, documentation, local-only shell |
| `engine.test.mjs` | IRR, cash flows, financing, price ceilings, scenarios, sensitivity, evidence |
| `smoke.test.mjs` | Assets/imports, routes, store, loader, SVG geometry, minimal-DOM scene interactions |
| `radar.test.mjs` | Matching, scoring, cache, sorting, presets, aggregates |
| `building-overview.test.mjs` | Lease expiries/waterfall and comparable selection |
| `bid.test.mjs` | Bid policies, guidance, annual charts, sensitivity, price ruler |
| `valueup.test.mjs` | Intervention timing/costs, floor heat, unavailable results |
| `evidence.test.mjs` | Provenance navigation, modal/focus, mode synchronization, scene integration |
| `proposal.test.mjs` | Price ranges, comparables, scenarios, financial reconciliation |
| `proposal-view.test.mjs` | Buyer/seller rendering, broker text, charts, print controls/A4 rules |
| `integration.test.mjs` | Cross-scene reconciliation for all deep buildings and three LTVs |

- Expected breaks: shell tests prohibit external URLs; import tests assume local, Node-importable modules; smoke tests import projection/viewBox helpers and inspect SVG circles.
- `smoke.test.mjs` and `evidence.test.mjs` construct Radar with minimal DOM fixtures lacking WebGL. Inject a map adapter for these tests.
- `data.test.mjs` rejects HTTP URLs in generated files and demands exact generator output. Local photo URLs fit existing constraints.
- Browser tiles, clustering, touch/keyboard behavior, popup imagery, WebGL failures, and actual printing remain **UNKNOWN**.

**6. Runtime and network**

- `node`/`npm` are absent from PATH.
- Verified bundled runtime: `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\76f5b5935a63c7ba\bin\node.exe` → **v24.22.1**.
- Its bundled Corepack npm launcher reports **12.2.1**. Another runtime directory, `6ef99b3d04073aa7`, also exists.
- Local shell HEAD requests to `unpkg.com` and `tiles.openfreemap.org` failed through proxy `127.0.0.1`. Web research could read official documentation; this does not establish browser connectivity.
- Browser CDN/tile/glyph/photo access, WebGL support, and running preview endpoint: **UNKNOWN**. Nothing installed.

**7. Risks and concrete edit order**

1. **01 — Design guide:** create `docs/DESIGN_GUIDE.md`; define map/list proportions, Korean typography, photo treatment, pricing hierarchy, controls, scene states, mobile behavior, and persistent example-data labeling.
2. **02 — Photos:** establish the licensed/example pool and manifest; add stable generator-backed assignments; wire shared imagery with loading/error states; update affected data checks.
3. **03 — Map:** establish an injectable adapter and deferred mount lifecycle first; then CDN loading, GeoJSON, clustering, matching/context layers, hover, photo popups, routing, cleanup, and failure fallback. Verify local network/browser access early.
4. **04 — Scenes:** update tokens/shared components, then Radar, building overview/Listings, Max-bid, Value-up, Evidence, and Proposals; preserve formulas, provenance controls, and A4 layout.
5. **05 — Validation/docs:** adapt tests incrementally during 02–04, run the full suite, then browser-check routes, filtering/counts, clusters, image errors, keyboard/mobile interactions, repeated navigation, and printing; update existing `docs/SUMMARY.md`.

Material risks: believable maps/photos implying real properties; cluster counts diverging from filters; asynchronous map leaks; inaccessible canvas interactions; external-resource failures; accidental generated-data drift; and print regressions. Existing Pages workflow deploys **`plot-os-demo/dist/client`**, not `web-v2`; deployment remains separate.

STATUS: DONE