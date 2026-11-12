# PLOT OS v2 progress log

## Step 1 — Data basis (2026-11-12)

### Done

- Created `docs/data-sources.md` and `web-v2/data/market_refs.json`: 10 districts, six metrics per district (60 rows), eight shared financing/deposit/cost assumptions and seven explicit UNKNOWN rows; 75 rows total.
- Included separate land/GFA purchase-price bands, 1F/upper-floor monthly rents, physical vacancy and forward NOI cap-rate bands. Jongno and Jung are separate; Gwangjin is the additional district.
- Every row has a unique id, value/range, unit, candidate source names/ids, exact `reference/approximate - verify` tag, low confidence, unverified status and assumption provenance. Source titles, URLs, publication/access dates and market observation dates are UNKNOWN. No sources were consulted and no web access was used.
- Documented rate/area conventions, refundable deposits, 4.6% demo tax allowance, brokerage/miscellaneous costs, lender fees, exclusions and a checked funding example. Bands are broad 2024–2026 model estimates, not verified November 2026 observations.
- Added Korean placeholder with `예시 데이터 · 실제 매물 아님` and a relative JSON link; prepared tracked CSS, JS engine, data, scripts and tests folders. Existing `.gitignore` already covers `verify/`; no ignore-rule change needed.

### Files

- `docs/data-sources.md`
- `docs/PROGRESS.md` (this appended section; existing UTF-8 BOM removed)
- `web-v2/data/market_refs.json`
- `web-v2/index.html`
- `web-v2/css/.gitkeep`
- `web-v2/js/engine/.gitkeep`
- `scripts/.gitkeep`
- `tests/market-refs.test.mjs`

### Commands and results

- Read `docs/PLAN.md`, `docs/context/step00-analysis.md`, `docs/PROGRESS.md` and `.gitignore`; read-only `git status --porcelain=v1 -b` confirmed `demo/plot-os-v2` with no initial changes. No paths linked to the main tree in the historical analysis were opened.
- Used the specified bundled Node (`v24.22.1`) and Node built-ins only; no installs, external requests, servers or git write commands.
- `node --test tests/` (using the full bundled executable path): blocked by sandbox child-process creation, `spawn EPERM`; no tests completed in that mode.
- `node --test --test-isolation=none tests/market-refs.test.mjs` (same executable): **8 passed, 0 failed**. Checks cover encoding/BOM and size, district/metric completeness and units, unique ids, ranges/defaults, candidate source integrity, UNKNOWN preservation, shared references, document/JSON consistency, funding arithmetic and placeholder/folder layout.
- An initial PowerShell-to-Node text pipe lost Korean characters. Direct UTF-8 file input corrected the affected data/documentation; checks reproduced the failure before correction and passed afterward. Temporary repair inputs were confined to ignored `verify/` and removed.
- `git diff --check`: passed. `git check-ignore verify/step01-check.txt`: matched the existing ignore rule. Deliverable paths did not match ignore rules (the expected `git check-ignore` result is exit 1).
- Final file inventory/UTF-8 size inspection and repeat test results are recorded in the step handoff. JSON remains below 200 KB and every created file below 1 MB.

### Known issues

- All market and financing values are deliberately unverified, low-confidence demo assumptions; source names are verification candidates, not citations supporting the endpoints. The checks validate the data contract and arithmetic, not market accuracy.
- Standard subprocess-isolated test mode is blocked in this sandbox; use the documented in-process command above. Placeholder UI has no application behavior yet and was not visually browser-tested.

### UNKNOWNs

- Actual observation/report dates and current November 2026 market levels, actual lender underwriting/rates/fees and transaction-specific tax treatment.
- Deposit/rent conversion interest rate, VAT treatment, itemized owner operating costs, basement rents and building-specific exclusive-area/GFA ratios.
- Real transaction, rent-roll, customer and owner evidence was not accessed or included. Subsequent steps need explicit building assumptions or verified inputs; UNKNOWN must not silently become zero.

## Step 2 — Deterministic mock data (2026-11-12)

### Done

- Built `scripts/generate-data.mjs` with a fixed string seed, FNV-1a/Mulberry32 PRNG, fixed snapshot date, Node built-ins only, and no network, clock-dependent inputs or external records. It reads the existing `market_refs.json` and writes only the named generated files under `web-v2/data/`.
- Generated **400 buildings** (40 per gu), **25 deep records**, **150 fictional comparable transactions** and **10 schematic gu polygons plus a rough Han river line**. All selected neighborhoods are represented. Asking prices span **30.03–149.98억 KRW**, land is 100–500 m², construction years are 1985–2022, and buildings have 3–8 above-ground floors with zero or one basement.
- Summaries include mock masked block addresses, explicitly fictional names, use mix, zoning, station association/walking time, status, days on market, motivation, area-weighted occupancy, operating income/expenses, refundable deposits, NOI, derived cap rate, illustrative income value band and deep-file links.
- Each deep file includes unit areas in m²/pyeong, potential and contracted rent, management fees, refundable deposits, tenant categories, lease dates, vacancy and renewal risk; five owner opex categories; two historical capex events; 5–8 nearby same-gu comp links with schematic distances; and three value-up notes with explicit budgets/downtime/uplift assumptions.
- Every numeric JSON leaf has an exact same-key provenance object on its containing record: kind, refId/formulaId/assumptionId and low confidence. `generation.json` documents units, formulas, synthetic assumptions, reference dependencies, file paths, accounting conventions and all seven unresolved reference UNKNOWNs. All files carry `예시 데이터 · 실제 매물 아님` and unverified status.
- NOI is derived from occupied contract rents plus collected management fees less owner expenses, without a second vacancy deduction. Deposits and historical capex are excluded from recurring NOI. Asking/comp prices satisfy the intersection of demo, land-price and GFA-price bounds; cap-rate bands do not manufacture rent or NOI.
- Added the consumer/schema contract in `docs/context/step02-data-contract.md` and eight behavior tests in `tests/data.test.mjs`. A separate read-only reviewer found no Critical or Important defects and independently confirmed price-band consistency.

### Files

- `scripts/generate-data.mjs`
- `tests/data.test.mjs`
- `web-v2/data/buildings.json`
- `web-v2/data/comps.json`
- `web-v2/data/districts.json`
- `web-v2/data/generation.json`
- `web-v2/data/deep/bld-*.json` (25 files)
- `docs/context/step02-data-contract.md`
- `docs/PROGRESS.md` (this appended section)

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- `node --test --test-isolation=none tests/data.test.mjs` before implementation: failed with the expected `ERR_MODULE_NOT_FOUND`. New regression assertions subsequently reproduced fractional rounding tails and summary/rent-roll use disagreement; both passed after correction.
- `node scripts/generate-data.mjs`: exit 0; 400 buildings, 25 deep files, 150 comps, 10 gu; asking range 30.03–149.98억.
- Exact requested `node --test tests/`: blocked by sandbox child-process creation (`spawn EPERM`); no tests completed in isolated mode.
- `node --test --test-isolation=none tests/`: this runtime rejects the directory argument (`ERR_UNSUPPORTED_DIR_IMPORT`).
- `node --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs`: **16 passed, 0 failed**. Covers schema/counts, numeric ranges/units/provenance resolution, privacy/mock labels, polygon containment, rent/area/expense/NOI/deposit consistency, comp links/distances, fixed-seed byte identity, different-seed variation, input immutability and malformed/infeasible reference rejection, plus all existing reference tests.
- Independent Node built-in byte/hash inspection: all **29 generated JSON files** exactly match a fresh in-memory run. Largest is `buildings.json`: **991,431 bytes**; `comps.json`: **154,295 bytes**; `districts.json`: **18,373 bytes**; `generation.json`: **12,931 bytes**; deep files **11,452–23,159 bytes**. Every output is strictly below 1,000,000 bytes and UTF-8 without BOM.
- Five additional seeds (`a` through `e`) serialized successfully; summary sizes were 990,832–991,692 bytes. Serializer checks all file sizes before the CLI writes any outputs.
- `git diff --check`: passed. Read-only `git status` confirmed this is `demo/plot-os-v2`; no git write commands, installs, services, excluded data or main-tree paths were used.

### Known issues

- All data is fictional and low-confidence. Reference sources remain unconsulted verification candidates, not evidence supporting actual properties or transactions. Checks establish demo data integrity, not market accuracy.
- Geometry is deliberately schematic. Coordinates are jittered within the gu sketch; neighborhood/station associations and walk times are illustrative, not measured routes or real building locations. Only the ten selected gu are represented.
- Suite-level vacancy is discrete; realized area vacancy can differ from the reference envelope. Derived cap rates can fall outside reference cap bands; this is explicit and is not corrected by reverse-engineering rent. Value bands are unverified income illustrations, not appraisals.
- `buildings.json` is compact JSON to meet the size limit. Future schema expansion may require sharding; serialization rejects oversized output before writing.
- Standard isolated test mode is sandbox-blocked; the equivalent full set of test files passes in-process. No browser/visual verification was needed for this data-only step.
- Final review minor (deferred): automated tests cover global price bounds and NOI/cap arithmetic, but do not directly assert each district land/GFA band or the estimated-value formula. The reviewer independently checked all district price bands and found zero violations; the current value formula was reviewed in code. These optional assertions can be added with later engine/data-contract work.

### UNKNOWNs

- Current verified market observations, actual transaction/lease evidence, real floor areas/condition, routing distances, owner expenses and capex quotes.
- The seven existing reference UNKNOWNs remain unresolved, including VAT/tax treatment, deposit conversion rate, current market date, real owner opex, basement rents and exclusive/GFA ratios. Explicit synthetic building assumptions supplement the demo without replacing those UNKNOWNs.
- Actual lease renewal behavior, permitted use changes, lender underwriting and intervention feasibility require later verified evidence; no real customer, owner or tenant records were accessed.

## Step 3 — Calculation engine and tests (2026-11-12)

### Done

- Implemented a pure, zero-dependency native ES module API in `web-v2/js/engine/`, with a local `type: module` declaration for browser/Node compatibility. No DOM, network, clock, random inputs, storage or external packages.
- Added configurable monthly cashflows (10 years by default): potential/collected rent, separate vacancy and credit loss, management income, owner opex, annual growth, recurring/upfront/intervention capex, inherited deposits, bank debt service and exit. Interest-only and constant-payment amortizing loans include zero-rate handling, principal roll-forward and remaining-balance sale repayment.
- Itemized the existing demo acquisition tax, brokerage, miscellaneous and loan-fee budgets. Deposits reduce initial equity, remain outside NOI and are settled at exit. Non-positive equity is flagged; income-based exit value is explicitly floored at zero for non-positive forward NOI, with a warning.
- Added evidence-wrapped NOI, cap rate, cash-on-cash, equity required, first-year/minimum holding-period DSCR, levered/unlevered annualized monthly IRR, equity multiple including future capital calls, and month-end payback. Numeric results remain unrounded. Evidence contains formula text, assumptions/source provenance, calculation dependencies, engine version, low confidence and verification flags.
- Implemented Newton IRR in log-rate space with bracketed bisection fallback, scaled evaluation, zero-period trimming, explicit no-solution/bounds/convergence states, and conservative ambiguity handling. Multiple cashflow sign changes never silently select a root. Historical annual benchmark (~0.63005% IRR and 1.03 multiple), monthly compounding, forced fallback, negative returns and sparse 50-year cases are tested.
- Added max purchase prices at target IRR and minimum DSCR with fixed-LTV re-sizing, bisection to the feasible side, funding-domain checks, combined binding constraint, achieved metrics and explicit infeasible/unsupported/search-bound states. DSCR uses the worst annual holding bucket, including a final partial year.
- Added five-lever tornado and two-dimensional grids, recomputing IRR and combined max price at every endpoint/cell. Added lease-up, remodel and use-change comparisons with capex timing, affected-share downtime, rent uplift, deposit refunds/restoration/new liabilities, same-date before/after NOI/value, full-horizon IRR and timeline metadata.
- Added Step 2 summary/deep adapters with rent-weighted vacancy and explicit management-income gross-up assumptions. All 400 summaries and all 25 detailed records reproduce original NOI/cap/funding without double vacancy deductions. Historical capex remains excluded.
- Documented the public API, defaults, formulas, evidence contract, units, accounting decisions, scenario conventions, example calls, solver bounds and omissions in `docs/context/step03-engine-contract.md`.

### Files

- `web-v2/js/engine/index.js`
- `web-v2/js/engine/evidence.js`
- `web-v2/js/engine/irr.js`
- `web-v2/js/engine/model.js`
- `web-v2/js/engine/pricing.js`
- `web-v2/js/engine/sensitivity.js`
- `web-v2/js/engine/scenarios.js`
- `web-v2/js/engine/adapters.js`
- `web-v2/js/engine/package.json`
- `tests/engine.test.mjs`
- `docs/context/step03-engine-contract.md`
- `docs/PROGRESS.md` (this appended section)

### Commands and results

All Node commands used the exact bundled executable from PLAN.md:
`C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read `docs/PLAN.md`, `docs/context/step00-analysis.md`, `docs/PROGRESS.md`, Step 2's data contract, data-source assumptions, existing tests and fictional data inside this worktree. Read-only git status confirmed `demo/plot-os-v2` with no initial changes. No historical main-tree links were opened.
- Exact requested `node --test tests/`: blocked by sandbox child-process creation (`spawn EPERM`), exit 1; no isolated tests completed. Used the already-documented equivalent explicit in-process test invocation.
- `node --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs tests/engine.test.mjs`: final **57 passed, 0 failed** (41 engine tests plus all 16 existing tests), exit 0. Earlier implementation runs also passed at 51 and 55 tests as edge-case coverage was expanded.
- Checks include independent IRR/DSCR/amortization benchmarks, funding example, deposits/exit settlement, monthly timing/growth, zero/negative inputs and returns, missing/UNKNOWN rejection, payback/multiple, price monotonicity, target-price IRR within 1e-8, analytic DSCR price within 1 KRW, tied/infeasible constraints, 100% LTV with capex equity, bounded/ambiguous results, sensitivity endpoints/orientation, intervention costs/downtime/deposits, deterministic/input-preserving behavior and all-data reconciliation.
- `git diff --check`, read-only final status, and a Node built-in inspection of all Step 3 files: passed. Inspection verified UTF-8 without BOM/replacement characters, every file below 1,000,000 bytes and all changed/untracked paths within the Step 3 worktree scope.
- No git write commands, installations, web requests, servers, excluded files, secrets, real customer data or real owner records were used.

### Known issues

- Standard isolated test mode remains sandbox-blocked; the complete suite passes in-process. This engine-only step did not wire or browser-test the later UI.
- IRRs with more than one cashflow sign change are deliberately withheld as `ambiguous`, even if one numerical root might be valid. The diagnostic scan is not complete root enumeration; price recommendations requiring a unique IRR are unavailable for such flows. Target-rate NPV boundaries are diagnostic only in these cases.
- Fixed-LTV price solving does not represent actual lender underwriting. The computational ceiling is explicitly a lower-bound-only result when reached. DSCR is undefined without scheduled debt service and never displayed as infinity.
- Management income follows rent-weighted occupancy; owner opex persists during downtime. Scenario inputs are simplified whole-building/affected-share projections, not unit-level lease-expiry or construction schedules. An incomplete-at-sale intervention warns about assumed future completion in exit NOI.
- Defaults are unverified budgets: acquisition tax is approximate; VAT, income/capital-gains taxes, prepayment penalties, refinancing and detailed renewal/credit behavior are excluded. Unlevered returns remove bank financing while retaining refundable tenant liabilities. All conventions are explicit in the contract and warnings.

### UNKNOWNs

- Actual market observations, property/rent-roll evidence, lender terms, deposit deductions/negotiations, transaction-specific taxes/VAT and management-fee recoverability.
- Lease renewal/collection behavior, construction costs/duration, feasible rent uplift and permitted use changes. No actual asset, tenant, owner or customer evidence was accessed.
- The seven reference UNKNOWNs remain unresolved. Engine defaults and synthetic building inputs are separate modeling assumptions, never substitutes for verified evidence.

## Step 4 — App shell, design system and SVG map (2026-11-12)

### Done

- Replaced the placeholder with the Korean PLOT OS shell: sticky navy navigation, Deal Radar / Listings / Proposal destinations, global evidence mode, persistent `예시 데이터 · 실제 매물 아님` badge, loading/error/retry states, skip link, page titles and footer.
- Added design tokens, layout/component styles and A4 print CSS: light content cards, teal accent, system Korean fonts, tabular figures, focus/reduced-motion rules and responsive breakpoints. Added the landing hero with the specified tagline and three value points.
- Built native-module hash routing, session state and cached relative JSON fetches, including request deduplication, retry after failure, allowlisted paths, deep-record validation, stale async render protection and view cleanup. No dependencies or external resources.
- Implemented shared KPI card, chip, slider/output, semantic table, badge, dialog side panel, toast, evidence number, button and empty-state components. Key summary/engine numbers open a panel with formulas, inputs, provenance, low confidence, verification flags and UNKNOWNs.
- Implemented SVG projection from `districts.json`: ten schematic gu polygons, Han river, 400 building dots, district labels, legend, hover/focus tooltip and building activation. Added viewBox pan/zoom/reset with bounds, wheel/buttons/keyboard controls, roving building focus, matching/dimmed states and listener cleanup.
- Connected a working exploration slice: region/search/price/walk/deep-data filters shared by radar and listings, real aggregate KPIs, up to 24 candidate cards, sorting/pagination, building overview with lazy rent roll and engine-derived metrics, and explicitly limited buyer/seller building-summary proposals with an A4 print action.
- Added the UI/extension contract in `docs/context/step04-ui-contract.md`; reserved future bid/value-up routes show an honest unavailable state. Optional Pipeline omitted.

### Files

- `web-v2/index.html`
- `web-v2/css/tokens.css`, `layout.css`, `components.css`, `print.css`
- `web-v2/js/app.js`, `data.js`, `router.js`, `store.js`, `views.js`, `package.json`
- `web-v2/js/ui/components.js`, `format.js`, `map.js`
- `tests/smoke.test.mjs`; updated the obsolete placeholder-only assertion in `tests/market-refs.test.mjs`
- `docs/context/step04-ui-contract.md`, `docs/PROGRESS.md`
- Temporary verification-only scripts under ignored `verify/`; no screenshots, images, fonts, PDFs or other binary artifacts created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read the required plan, historical analysis and progress, plus Step 2/3 contracts and existing tests/data/engine within this worktree. Initial read-only status confirmed `demo/plot-os-v2` with no changes. No historical main-tree links or excluded data were opened.
- Exact requested `node --test tests/`: exit 1, sandbox child-process `spawn EPERM`; isolated tests did not complete.
- `node --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs tests/engine.test.mjs tests/smoke.test.mjs`: final **69 passed, 0 failed**, exit 0 (57 existing + 12 smoke). An initial smoke run found a proposal-view syntax error; it was corrected before the passing runs.
- Smoke checks cover every JSON parse (32 files), UTF-8/no BOM/size, every native module import and relative dependency, local HTML references, hash routes/history cleanup, store/filter behavior, loader deduplication/retry/schema, every map coordinate, viewBox bounds/zoom anchoring, and null formatting.
- Minimal DOM fixture with real synthetic data: all five views construct; 400 circles/10 polygons; filter no-result/reset; 24 candidate cards; lazy detailed rent roll; proposal picker/seller audience; virtual map activation and listener teardown pass. This verifies DOM construction/logic, not browser rendering.
- Temporary zero-dependency server at `http://127.0.0.1:4784/demo/` plus `node verify/step04-http-check.mjs`: **53 assets HTTP 200**, byte-identical to disk, JSON parse and JavaScript MIME correct. Server stdin was unavailable; its exact loopback listener PID was identified and stopped. Confirmed port 4784 no longer listening. No server left running.
- Browser host discovery failed (`browser access host is unavailable`). The computer-use fallback was stopped by URL-confidence policy before the demo could be inspected. No browser screenshots, layout, console, native interactions or print-preview results are claimed.
- `git diff --check`: passed (Git reports existing LF/CRLF normalization warnings). No git write commands, network installs, external requests, secrets, real records or main-tree changes.

### Known issues

- Actual browser rendering, desktop/mobile viewport layout, console behavior, native hover/pointer/keyboard behavior and print pagination remain unverified because browser automation was unavailable/stopped. CSS breakpoints and print rules are implemented; DOM/math/HTTP checks are not visual QA.
- Requires HTTP serving for native modules/JSON. Works without external internet when locally served; `file://` has an explanation. No service-worker persistence for reopening a hosted site offline. State is session-only and resets on reload.
- Radar currently filters physical/search criteria and shows Cap rate, not investor IRR scoring. Max-bid/value-up UI, full investor matching and complete proposal/evidence appendices remain subsequent-step work. Current proposal is clearly labeled a building summary, with no recommended bid or valuation.
- Map geometry and building positions are fictional sketches. All underlying market numbers, financial assumptions and model outputs have low confidence and require verification. Engine exclusions from Step 3 remain applicable.

### UNKNOWNs

- Real market observations, actual leases/expenses/condition, lender underwriting, tax/VAT treatment, intervention feasibility and the seven reference UNKNOWNs remain unresolved. No new market claims or real customer/owner/tenant data were introduced.
- Final browser appearance, performance, console state, physical pan/zoom behavior and A4 page count require browser access; no visual or print assurance is inferred from the passing smoke tests.

## Step 5 — Deal Radar and building overview (2026-11-12)

### Done

- Replaced the exploratory radar with investor criteria: equity budget in 억, target levered IRR, LTV, district multi-select, minimum/maximum asking price, included building use, maximum subway walk time, search and deep-only filter. Range controls update on input and preserve native elements/focus; crossing a price bound moves the other bound. State survives route changes within the session.
- Implemented the three exact PLAN presets: `자기자본 30억 · IRR 8%`, `강남 사옥용`, `성수 밸류업`. Presets reset all criteria and show active/custom status. Office/value-up presets explicitly remain current-income screens; owner-occupation benefits and value-up interventions are not invented.
- Each of 400 buildings uses the existing engine/adapter at asking price and selected LTV. Initial equity includes acquisition costs, bank fees and inherited deposits; annualized levered IRR uses monthly cashflows. A match must pass all six investment gates plus search/deep/status filters. Unavailable IRR never passes. All buildings remain on the map; matches highlight and other/closed records dim. Map/card hover and click-through remain connected.
- Added fit score (0–100), exact `왜 맞는지` label, six numeric reasons, evidence for score/IRR/equity, sorting by score/IRR/asking price/equity, 20-card pagination, and optional financial near misses within the physical screen. A disclosed score formula rewards financial headroom; it is not confidence or valuation. KPI strip shows match count, median IRR, median **land-basis** price per 평, and inventory-wide unavailable-IRR count. Empty medians remain unavailable.
- Bounded financial memoization retains only the needed metrics in at most three LTV slices, keyed by immutable building snapshot objects. Physical/target/budget changes reuse engine evidence; LTV input events coalesce for 100 ms; sorting/pagination do not rerun financial models.
- Extended building overview with six headline metrics (ask, NOI, cap, equity, IRR, DSCR), current radar LTV, building facts and links to bid/value-up/buyer proposal. Deep rent rolls include unit, category/use, occupied/vacant state, area, deposits, rent, management fees, start/end dates and assumed renewal risk.
- Added accessible native SVG lease-expiry waterfall for all 25 deep records: snapshot-date boundaries, overdue and five annual expiry buckets, current/remaining monthly rent, 12-month exposure and explicit unknown expiries. Vacant units are excluded; expired rent plus remaining rent conserves the occupied total. This is contractual rent exposure with no renewal, not a vacancy prediction or replacement of the engine's operating assumptions.
- Added 5–8 linked synthetic comps for deep buildings; summary-only buildings show six same-district examples nearest in schematic coordinates. Tables distinguish transaction price, land/GFA unit prices and assumed distances, and evidence correctly identifies `data/comps.json`. No public transaction or adjusted valuation is implied. Summary-only rent-roll/waterfall states remain explicit.

### Files

- `web-v2/js/radar.js`, `web-v2/js/ui/radar-view.js`
- `web-v2/js/building-analysis.js`, `web-v2/js/ui/lease-waterfall.js`
- `web-v2/js/views.js`, `web-v2/js/store.js`, `web-v2/css/components.css`
- `tests/radar.test.mjs`, `tests/building-overview.test.mjs`, `tests/smoke.test.mjs`
- `docs/context/step05-implementation-plan.md`, `docs/PROGRESS.md`
- Verification-only `verify/step05-check.mjs` (gitignored); no binary artifacts/screenshots created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read PLAN first, then Step 0 analysis/progress and the Step 3/4 contracts, engine/UI code and synthetic data within this worktree. Initial read-only status was clean. No historical main-tree links or excluded files were opened.
- `node --test tests/`: exit 1, sandbox child-process `spawn EPERM`; no isolated test completed.
- `node --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs tests/engine.test.mjs tests/radar.test.mjs tests/building-overview.test.mjs tests/smoke.test.mjs`: **77 passed, 0 failed**, exit 0 (69 existing plus eight new analytical tests; existing DOM smoke expanded). New tests were observed failing before their implementations.
- Coverage includes engine equivalence and engine-version evidence, all six hard gates/closed/unavailable cases, score headroom, cache reuse/LTV invalidation/bounds, sorting/nulls/medians/preset regions, lease-date boundaries/leap years/invalid dates/overdue/unknown/vacant records, rent conservation and deep/summary comps joins. DOM checks cover preset active state, crossed price bounds, default match count/map dimming, score reasons, sort order, near-miss pagination, live LTV updates, detailed tables/SVG/action links, comparable evidence and summary-only fallback.
- `node verify/step05-check.mjs`: all 400 evaluations; default **3 matches**, median IRR **8.9333736823%**, median land price **54,013,358.9947 KRW/평**. Presets currently yield 3 / 0 / 1 matches in order. All 25 waterfalls conserve monthly rent and linked comps resolve. Representative Node timings: cold 442.7 ms, changed LTV 404.3 ms, cached filter median 1.82 ms/max 5.06 ms across 20 runs. These are Node timings, not browser frame-rate claims.
- The same check served **59 assets** beneath `/demo/` with HTTP 200, byte-identical content, correct JavaScript MIME and UTF-8/no BOM/sub-1MB assertions. Transient loopback server closed in `finally`; verified `serverClosed: true`. No long-running server left behind.
- Browser discovery returned `The browser access host is unavailable`. No browser navigation, screenshot, console, physical-input or print-preview checks are claimed.
- `git diff --check`: passed with LF/CRLF normalization warnings. Read-only diff/status reviewed. No git write commands, installations, external network resources, real records or changes outside the dedicated worktree.

### Known issues

- Browser layout, actual browser performance/console, native pointer/keyboard behavior and print pagination remain unverified because the browser access host is unavailable. Minimal DOM/HTTP checks do not establish visual QA.
- The Gangnam office preset returns zero matches under its 0% rental-IRR floor in this synthetic inventory. This is shown honestly; optional financial near misses expose the failed gates. The preset does not model saved owner-occupancy costs. The Seongsu preset does not apply an intervention; future value-up work owns that calculation.
- Bid/value-up action links reach the existing explicitly unavailable future routes. The current proposal remains the Step 4 building-summary proposal with its own disclosed defaults; complete bid/value-up/proposal scenes are later steps.
- Listings retain the shared physical criteria and explicitly disclose that IRR/equity gates apply in Radar. Match equity is the **initial** funding requirement, not a guarantee that future cash calls fit the same budget. Financial defaults/exclusions from Step 3 remain in force.
- Session-only state and HTTP-serving requirement remain unchanged. Three LTV cache slices bound memory; uncached LTV changes still project the whole inventory.

### UNKNOWNs

- Actual current market prices/rents, verified leases and renewal/collection behavior, expenses, building condition, lender underwriting/deposit deductions, transaction-specific taxes/VAT, owner-occupation benefits and intervention feasibility. The seven reference UNKNOWNs remain unresolved.
- Final browser appearance, console state, interaction responsiveness and A4 page count. No real customer, owner, tenant or actual lot-level records were accessed.

## Step 6 — Max-bid calculator (2026-11-12)

### Done

- Implemented `#/building/<id>/bid` with route title, active navigation, loading/error handling and links from the existing building overview. All 400 buildings use the existing monthly engine; the 25 deep records use their unit rent rolls, deposits and owner expenses. The page identifies detailed versus summary inputs and keeps the example-data label visible.
- Added seven stable native sliders: current purchase price, loan rate, LTV, rent-weighted vacancy/loss, rent growth, exit cap and holding years. Core IRR, minimum holding-bucket DSCR (plus first-year DSCR), initial equity and equity multiple update synchronously on input. No-debt DSCR is explicitly not applicable; unavailable IRR and invalid equity do not produce BUY guidance.
- Added editable target IRR, minimum IRR floor and minimum DSCR policies. Target/LTV inherit Radar; default floor is target minus 3 percentage points with a zero floor for nonnegative targets and a −99% bound for negative targets; DSCR defaults to 1.20. Crossing target/floor adjusts the companion field with an explanation; empty/out-of-range input preserves the last valid value. Reset restores initial assumptions.
- BUY solves the combined target-IRR/minimum-DSCR ceiling; WALK-AWAY solves the combined IRR-floor/same-DSCR ceiling. Both use fixed LTV with re-sized debt and transaction costs. The SVG price ruler includes ask, current price and both available ceilings on separate rows, including coincident/outside-slider values. Each ceiling identifies its binding constraint and individual IRR/DSCR limits. Unavailable or computational-bound outcomes are withheld as exact lines.
- Added Korean negotiation guidance: target achieved, target-price negotiation, walk-away/reprice and unavailable-result states. It compares current realized metrics and price ceilings, states the BUY-vs-ask adjustment and WALK-AWAY boundary, and distinguishes closed reference records. Monetary proposal ceilings are floored to 0.1억 for display; chart positions and percentage comparisons retain the raw solved values. All are explicitly example policies, not investment advice or lender approval.
- Added accessible local SVG annual cashflow chart with separate initial funding, operating distributions/calls and net sale settlement, including negative cashflows; expandable annual numeric table conserves monthly totals. Funding/settlement summary exposes engine evidence and describes acquisition costs, deposits and final debt repayment.
- Added sensitivity tornado for rate, vacancy, rent growth, exit cap and initial capex, with signed IRR changes and an expandable endpoint/IRR/BUY table. Added a 3×3 rate-column × exit-cap-row grid with IRR and combined BUY ceiling in every cell; the center identifies current assumptions. Sensitivity clears stale output and recomputes after 180 ms of quiet input; route destruction cancels pending work. No interpolation or linear return approximation.
- Key metrics, ceilings, funding and sensitivity values open the existing evidence panel. Input overrides carry explicit low-confidence assumption provenance; rent-roll and summary source lineage is retained. No new dependencies, external data, assets or network resources.

### Files

- `web-v2/js/bid.js`
- `web-v2/js/ui/bid-view.js`, `web-v2/js/ui/bid-charts.js`
- `web-v2/js/app.js`, `web-v2/css/components.css`
- `tests/bid.test.mjs`, `tests/smoke.test.mjs`
- `docs/context/step06-implementation-plan.md`, `docs/PROGRESS.md`
- Verification-only `verify/step06-check.mjs` (gitignored); no screenshots or binary artifacts created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read `docs/PLAN.md` first, Step 0 analysis/progress, existing engine/UI contracts and relevant code/mock data within this worktree. Initial read-only status was clean. No historical main-tree links or excluded data were opened.
- Exact requested `node --test tests/`: sandbox exit 1 (`spawn EPERM`). Retried with approved local process execution outside the sandbox: exit 1 (`MODULE_NOT_FOUND` for `tests`). Node v24.22.1 treats this explicit directory argument as a module path; this invocation is not a successful suite run.
- Explicit-file in-process full suite (`--test --test-isolation=none` plus all seven test files): **83 passed, 0 failed** before final regression. Final focused in-process bid/smoke run: **19 passed, 0 failed**. New tests were observed failing before implementations/fixes.
- Final full suite with normal isolated workers outside sandbox: `node --test tests/market-refs.test.mjs tests/data.test.mjs tests/engine.test.mjs tests/radar.test.mjs tests/building-overview.test.mjs tests/bid.test.mjs tests/smoke.test.mjs` → **84 passed, 0 failed**, exit 0. This resolves the prior worker-blocking limitation for explicit-file execution; no test-directory command pass is claimed.
- Added seven analytical tests covering all-building/deep adaptation, engine-equivalent ceilings, DSCR binding/coincident limits, cash financing, invalid equity/loss cases, realized guidance gates, annual cashflow conservation/partial year, grid orientation/center and ruler domains. Final review identified Radar's supported negative targets; pure and DOM regressions failed before the fix and pass after it.
- Extended minimal-DOM smoke verifies deep/summary/missing-building bid views, three SVGs, all seven input-to-engine updates, stable control identity, policy crossing/empty input, cash/no-service display, full-vacancy unavailable state, reset, evidence lineage, inherited negative targets and pending-timer cancellation. This verifies DOM construction/logic, not actual rendering or native browser input.
- `node verify/step06-check.mjs`: **400 full bid analyses / 25 deep**, NOI reconciled, all default BUY/WALK-AWAY ceilings exact and ordered. All default BUY constraints are target IRR. A separate engine-status count confirms **273 current asking-price IRRs are `ok`, 127 are `no_solution`**, so guidance correctly withholds a recommendation for those 127 even though a lower-price ceiling can be solved. Representative final Node timings: median core analysis **9.18 ms**, max **63.84 ms**, representative sensitivity **165.46 ms**; these are Node timings, not browser latency claims.
- The same check served **62 assets** under `/demo/`: HTTP 200, byte-identical content, correct JavaScript MIME, valid UTF-8/no BOM and each below 1 MB. Ephemeral loopback server closed in `finally`; verified `serverClosed: true`. No server left running.
- Fresh focused code review reported no Critical/Important findings; separate own review found and repaired the negative-target integration issue. Browser inventory reported `The browser access host is unavailable`; native Chrome fallback stopped because the current URL could not be established confidently. Computer Use ended there; no screenshot, browser-console, focus, responsive rendering or print-preview verification is claimed.
- `git diff --check`: passed with LF/CRLF normalization warnings. Final Node inspection of all ten changed/verification text files confirmed valid UTF-8, no BOM and each below 1 MB. No git mutation commands, installations, real records, secret reads or changes outside this worktree.

### Known issues

- Browser appearance, actual native slider/focus/screen-reader behavior, console state and responsive performance remain unverified due to browser automation availability/policy constraints. The implemented responsive styles and DOM checks are not visual QA.
- Bid edits are local to the mounted page and reset after navigation/reload; Radar target/LTV are inherited again on entry. No saved-scenario/proposal propagation was added in this step. Value-up and complete proposal work remain later steps.
- Sensitivity runs on the main thread after the disclosed debounce; large endpoint models may cause a pause on slower devices. Charts allow horizontal scrolling on narrow screens. Cashflow tables are expandable. Native browser performance has not been measured.
- Engine return/price limitations remain: non-conventional cashflows may withhold IRR; exact price ceilings require a demonstrably unique IRR; this demo's fixed-LTV policy is not lender underwriting. Refundable deposits stay fixed when changing vacancy; actual lease/deposit negotiation is not modeled. Costs/taxes are unverified allowances and exclusions remain explicit.

### UNKNOWNs

- Real current market observations, verified leases/deposits/expenses, collection and renewal behavior, lender terms and underwriting, transaction-specific taxes/VAT, building condition/capex, seller willingness to negotiate and exit market conditions. The seven reference UNKNOWNs remain unresolved.
- Final browser rendering, console behavior, native interactions, screen-reader output and device latency. No actual customer, owner, tenant or lot-level address data was accessed.

## Step 7 — Value-up simulator (2026-11-12)

### Done

- Implemented `#/building/<id>/valueup`, with route title, active navigation, loading/error handling, existing overview/bid entry links and persistent example-data labeling. All 400 buildings use the existing monthly engine/adapter; 25 detailed records retain their rent-roll, deposit and owner-expense inputs. No engine arithmetic or mock inventory was changed.
- Added three toggleable execution plans: lease-up of vacant income, remodel and use change. One plan is active at a time; clicking it again restores existing operations. Each plan retains edits locally until reset/navigation. Deep synthetic notes seed cost/downtime/uplift; summaries disclose generic defaults. Controls adjust vacancy lease-up fraction, affected potential-rent share, execution capex, start month, downtime and rent uplift. Native controls stay mounted during synchronous recalculation.
- Added two accessible local SVG before/after bars for stabilized annual NOI and gross income value, plus levered IRR and percentage-point delta with evidence buttons. Both bars use the same stabilization-date 12 months and common cap rate; negative NOI is chartable, nonpositive NOI yields zero income value, and unavailable/ambiguous IRRs remain unavailable. Gross value is before execution costs; the additional cost-subtraction figure is explicitly not profit or NPV.
- Added a relative-month SVG downtime timeline with start/cost-payment month, leasing or partial closure, completion and improved operation. Cost diagnostics show execution capex and holding-period NOI lost during downtime. Existing engine cashflows retain continuing opex/debt service, refund/restoration of the affected deposit share and final deposit/debt settlement. No future lease deposit benefit or additional construction borrowing is invented.
- Added plain Korean explanations of vacant-income recovery, rent uplift, unchanged vacancy for physical works, costs/downtime, financial defaults, zero income value and use-change permitting uncertainty. One-plan comparisons and bulk affected-rent share are explicit; this does not pretend to allocate works to specific tenants/floors or forecast renewal/eviction dates.
- Added floor-by-floor current rent-roll heat strips for all 25 detailed records, with independent vacancy, below-reference rent and 12-month/overdue expiry flags, labels and evidence. Low-rent screening compares occupied contract rent per exclusive pyeong with 90% of the district/floor reference midpoint; references are unverified examples, not observed market values. Basement reference and missing/invalid comparisons or expiries remain unknown. Summary-only buildings show a missing-floor-data state and a detailed-example link.

### Files

- `web-v2/js/valueup.js`
- `web-v2/js/ui/valueup-view.js`, `web-v2/js/ui/valueup-charts.js`
- `web-v2/js/app.js`, `web-v2/css/components.css`
- `tests/valueup.test.mjs`, `tests/smoke.test.mjs`
- `docs/context/step07-implementation-plan.md`, `docs/PROGRESS.md`
- Verification-only `verify/step07-check.mjs` (gitignored); no screenshots or binary artifacts created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read PLAN first, Step 0 analysis/progress and relevant engine/UI/data contracts and code within this worktree. Initial read-only status was clean. No excluded files, historical main-tree links or real records were opened.
- Requested `node --test tests/`: exit 1, sandbox worker `spawn EPERM`. No directory-invocation pass is claimed.
- Full explicit-file suite: PowerShell collected all eight `tests/*.test.mjs` files and passed them to `node --test --test-isolation=none` → **91 passed, 0 failed**, exit 0. Focused scenario/DOM run before final review: 18 passed. New modules first produced missing-module failures; the final invalid-numeric regression failed before its repair and passed in the final full suite.
- Seven scenario tests cover independent lease-up arithmetic (+38.4m KRW/year NOI), partial construction (+28.8m/year NOI, 38.4m downtime loss, 576m gross value increase at 5% cap), deposit refunds/restoration, capex, annual-growth date alignment, zero downtime, toggle-off identity, paid no-op, null/ambiguous IRR, negative/zero chart domains, vacancy/reference/expiry boundaries, invalid dates/numerics, deep presets and summary/deep adaptation.
- Extended minimal-DOM smoke verifies all three plans and toggle-off/reset, stable live controls and engine evidence, retained per-plan edits, IRR unavailable state, permitting disclosure, 10-unit representative heat strip, summary/missing fallbacks and destruction. This checks DOM construction/events, not native browser rendering or pointer input.
- `node verify/step07-check.mjs`: **1,200 analyses / 400 buildings / 25 detailed records**, reconciled baseline NOI and all intervention capex payments, stabilized deltas and zero invented new deposits. Heat strips cover **157 floors / 314 units**, including 38 vacancies, 116 below-reference flags, 11 expiring units and 34 units with unknown basement reference. Default post-plan IRRs: lease-up 344 ok / 56 no-solution; remodel 186 ok / 214 ambiguous; use change 185 ok / 215 ambiguous. Deltas stay null whenever either return is unavailable.
- Representative Node scenario timings: median 2.15 ms, max 37.16 ms across 1,200 analyses. These are Node timings, not native browser latency claims. The same check served **65 assets** under `/demo/` with HTTP 200, byte-identical responses, correct JS MIME and UTF-8/no-BOM/sub-1MB checks. Ephemeral loopback server closed in `finally`; `serverClosed: true`.
- Separate read-only code review found no Critical/Important issues. Both minor findings were fixed: invalid rent/area no longer yields a low-rent flag, and the Korean value explanation now states the zero-NOI floor/land-value exclusion. No deferred review findings.
- Final PowerShell/.NET inspection confirmed valid UTF-8, no BOM and sizes below 1 MB for all ten changed/verification text files. An initial inline `node -e` audit failed because Windows argument quoting removed JavaScript quotes; the direct byte audit above replaced it. Final inventory recheck retained identical scenario/status counts and 65 valid HTTP assets; observed Node timing varied to median 3.48 ms/max 165.77 ms, reinforcing that browser latency is unverified.
- Browser inventory returned `The browser access host is unavailable`. Native blank-Chrome inspection was stopped because the current browser URL could not be established confidently for policy enforcement. No further UI automation, screenshots, console checks, responsive rendering or print verification is claimed.
- `git diff --check` passed with LF/CRLF normalization warnings. No git mutation commands, installations, external resources or edits outside this dedicated worktree. Runner owns integration.

### Known issues

- Actual browser appearance, focus/slider/screen-reader behavior, console and responsive/device performance remain unverified due to the browser automation blocker. DOM/HTTP checks do not establish visual QA.
- Compare one execution plan at a time; simultaneous/overlapping interventions and unit-specific construction allocation are not modeled. Floor flags describe the current snapshot, not an after-work rent roll. Value-up edits reset on navigation/reload and do not propagate into proposals.
- Existing conservative IRR policy withholds all multiple-sign-change returns, including potentially solvable individual cases; no approximate delta substitutes for an unavailable return. NOI/value comparisons remain available and the screen states the reason. Gross income value excludes execution/sale costs and taxes; the simple cost subtraction is not a discounted return.
- Assumed affected-share deposit refunds/restoration and zero new lease deposits are illustrative. Continuing expenses stay unchanged; rent-free incentives, permitting failures, additional use-change opex, tax/VAT and capex overruns need separate real inputs. The underlying engine exclusions remain in force.

### UNKNOWNs

- Actual rent/lease terms, market reference calibration, tenant consent and renewal/eviction timing, achievable lease-up/uplift, construction quotes and delays, physical condition, permitted use/building/fire compliance, lender underwriting and transaction-specific taxes/VAT. All seven reference UNKNOWNs remain unresolved.
- Browser layout/console/native interaction behavior and device latency. No actual customer, owner, tenant or lot-level records were accessed.

## Step 8 — Evidence trace (2026-11-12)

### Done

- Implemented a shared navigable evidence side panel for Radar, building overview, bid and value-up. Dotted numeric buttons open the displayed value, original engine/generator formula, individually clickable inputs, source lineage, confidence badge and the exact `검증 필요` label. Raw values, engine status and provenance remain available in an expandable section; null/UNKNOWN never becomes zero.
- Inputs drill into calculation assumptions, monthly cashflows, intervention inputs, reference ranges and metadata, summary records, individual synthetic rent-roll units and owner expenses. Source links resolve actual `market_refs.json` rows and generator definitions; rent-roll rent/area dependencies retain their exact values and floor-specific reference ids. Summary prices resolve the district land/GFA reference envelopes. Radar aggregate member ids open their synthetic building snapshots.
- Preserved edited bid assumptions and current engine outputs. An edited rate displays its `bid.input.*` identity rather than claiming it was observed in a market reference. Deep source records load on demand through the existing cached loader; loading/error states remain explicit, missing detailed records are never fabricated, and late completions cannot reopen a closed panel.
- Added Back navigation within one native dialog, dynamic input headings/focus, existing close/return-focus behavior and route-change cleanup. Each evidence button identifies a dialog and carries confidence metadata. The top-bar `근거 모드` toggle immediately synchronizes existing session state and highlights only low-confidence numbers; filter/route updates preserve it. All current mock numbers remain low confidence.
- Extended evidence coverage to Radar asking prices, score and all four KPI counts/medians; overview areas, occupancy and rent-roll area/deposit/rent/management fees; existing bid metrics, ceilings, funding and sensitivity; and existing value-up comparisons, deltas, costs and unit heat-strip evidence.
- Included the `data-sources.md` caution inline in every evidence view and added a relative, offline-readable deployment note under `web-v2/data/`. It identifies unverified model assumptions, candidate institutions rather than consulted sources, units, deposit liabilities, exclusions and UNKNOWNs. No market observations, formulas in the calculation engine, generated inventory or dependencies were changed.

### Files

- New: `web-v2/js/evidence-trace.js`, `web-v2/js/ui/evidence-panel.js`, `web-v2/data/data-sources.md`, `tests/evidence.test.mjs`.
- Updated: `web-v2/js/app.js`, `web-v2/js/ui/components.js`, `web-v2/js/ui/radar-view.js`, `web-v2/js/views.js`, `web-v2/js/ui/bid-view.js`, `web-v2/js/ui/valueup-view.js`, `web-v2/css/components.css`, `web-v2/index.html`, `docs/PROGRESS.md`.
- Verification-only: `verify/step08-check.mjs` (gitignored). No screenshots, binaries or images created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read `docs/PLAN.md` first, Step 0 analysis/progress, `docs/data-sources.md` and relevant local UI/engine/data contracts. Initial read-only status was clean. No excluded files, linked main-tree documents, real records or secrets were opened.
- Requested `node --test tests/`: exit 1, sandbox child-process `spawn EPERM`. No successful directory-command run is claimed.
- Full explicit-file suite: PowerShell collected all nine `tests/*.test.mjs` paths and passed them to `node --test --test-isolation=none` → **100 passed, 0 failed**, exit 0. Before adding evidence tests the existing suite passed 91/91. Final evidence-only run passed 9/9; preceding evidence/smoke run passed 20/20. Initial evidence tests exposed an incorrect test expectation (`bid.user.*`); it was corrected to the existing adapter contract `bid.input.*`.
- Nine evidence regressions check exact edited/default values, unit formatting, source-row ids/tag/candidate role, deep suite rent → floor reference traversal, missing-deep/UNKNOWN behavior, BUY/scenario wrappers, weakest-input confidence, modal/back/close/focus behavior, stale-async cleanup, lazy-load errors, global toggle state/disposal and real shared-control integration across all four requested scenes. These are pure/minimal-DOM tests, not native browser rendering or Escape/focus-trap verification.
- `node verify/step08-check.mjs` → **68 assets** served under `/demo/`, HTTP 200 with byte-identical content, correct JavaScript MIME, valid UTF-8, no BOM and every asset below 1 MB. The deployed data-source note and its market-reference link exist. Ephemeral loopback server closed in `finally`; reported `serverClosed: true`.
- `git diff --check`: passed with LF/CRLF normalization warnings. Final PowerShell/.NET byte audit of all **14 changed/verification text files** confirmed valid UTF-8, no BOM and each below 1 MB.
- Computer Use browser inventory again returned `The browser access host is unavailable`; no browser tab was available. No native app was controlled and no screenshots, console checks, responsive-layout or actual browser interaction verification is claimed.
- One exploratory inline `node -e` read failed because Windows command quoting removed JavaScript quotes; PowerShell JSON inspection replaced it. No installs, external network resources, long-running services or git mutation commands were used. All edits stayed inside this dedicated worktree; runner owns commits.

### Known issues

- Browser layout, real keyboard/focus-trap/Escape behavior, console and device responsiveness remain unverified because the browser access host is unavailable. Native dialog semantics and responsive styles are implemented; minimal-DOM/HTTP tests do not establish visual QA.
- Numeric chart labels duplicate nearby clickable metric/table values; the SVG labels themselves are not separate evidence controls. Evidence mode and edited assumptions are session/page state, with the existing route-reset behavior unchanged. The source-note file is a deployment summary of the authoritative `docs/data-sources.md` and must be kept aligned when the source policy changes.
- The exact requested directory-form test command remains blocked by sandbox process execution; the complete explicit-file in-process suite passed. Existing engine conservatism, synthetic-data limitations and financial exclusions remain in force.

### UNKNOWNs

- Actual market observation dates/levels, verified rent/lease/deposit/expense records, lender underwriting, transaction-specific taxes/VAT, construction/permit feasibility and real customer outcomes. All seven reference UNKNOWNs remain unresolved.
- Final browser rendering, native interactions, accessibility output, console and device latency. No actual customer, owner, tenant or lot-level records were accessed.

## Step 9 — One-click proposal (2026-11-12)

### Done

- Replaced the proposal placeholder with `#/building/<id>/proposal?for=buyer|seller`, preserving the global proposal picker and selected-building entry. Both audiences load the actual synthetic detailed rent roll/opex/deposits where available; summary-only buildings explicitly disclose missing detailed leases. Added proposal loading status and retained route/error/stale-view handling.
- Built five document sections: cover; executive summary/key numbers/risks; scenarios and charts; synthetic comps and asking-price explanation; printable evidence appendix, assumptions, seven UNKNOWNs and `면책 고지`. A4 portrait print rules hide the shell/controls, start each section on a fresh page, repeat table headings and allow content to flow without fixed-height clipping. Section footers include the example-data warning, broker name and section index.
- Buyer: engine-derived recommended bid range from conservative/base exact max-price ceilings, capped at ask. Conservative assumptions are rate +1%p, rent-weighted vacancy/loss +5%p, zero annual rent growth and exit cap +0.5%p. Both ceilings enforce target IRR and full-hold minimum DSCR; unavailable/bounded/unsupported prices never become a range. Non-positive initial equity at ask suppresses a recommendation even if a higher-price solver domain is feasible. Price-ceiling displays round downward.
- Seller: asking-price land-pyeong comparison against the connected synthetic comp min/median/max, median premium/discount, unadjusted subject-area price range, buyer IRR and minimum DSCR at ask. Explicitly states that raw synthetic comps do not substantiate an actual asking price; time/location/use/condition adjustments and real evidence are required.
- Five independently calculated scenarios at the same asking price: baseline, conservative financing/vacancy, lease-up, remodel and use change. Show first-year NOI, buyer IRR, execution budget and recruiting/shutdown months. Two accessible native SVG charts show first-year scenario NOI and baseline annual cashflows with separate initial/operating/net-sale amounts. Existing engine arithmetic and synthetic inventory were unchanged; ambiguous/no-solution IRRs stay unavailable.
- Added buyer/seller links, editable `중개사명` (default `예시 중개사`) and `인쇄` calling `window.print()` once. Broker input is rendered as literal text, reflected immediately in printable cover/footers, retained across audience changes in session, and defaults visibly when blank. View destruction disables its handlers. PLAN.md does not actually prescribe Korean literals for broker default/print/disclaimer; these labels are implementation choices, with the required `예시 데이터 · 실제 매물 아님` and `검증 필요` retained.
- Appendix includes visible formulas, actual inputs/costs/deposit/exit treatment, source file/record identities, low confidence and unconsulted-reference warnings. Dotted key metrics retain shared evidence inspection. Current Radar LTV/target IRR are disclosed; bid/value-up page edits do not propagate and this is stated in the report.

### Files

- New: `web-v2/js/proposal.js`, `web-v2/js/ui/proposal-view.js`, `web-v2/js/ui/proposal-charts.js`, `web-v2/css/proposal.css`.
- Updated: `web-v2/js/views.js`, `web-v2/js/app.js`, `web-v2/index.html`, `web-v2/css/print.css`.
- Tests: `tests/proposal.test.mjs`, `tests/proposal-view.test.mjs`.
- Documentation: `docs/context/step09-implementation-plan.md`, `docs/PROGRESS.md`.
- Verification-only: `verify/step09-check.mjs` (gitignored). No screenshots, PDFs, images or other binaries created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read PLAN first, supplied Step 0 analysis/progress and relevant local engine/UI/data code. Initial read-only `git status --short` was clean. No excluded files, linked main-tree documents, real records or secrets were opened.
- Requested `node --test tests/`: exit 1, sandbox child-process `spawn EPERM`; no successful directory-form run is claimed.
- Full suite: PowerShell collected all eleven `tests/*.test.mjs` paths and passed them to `node --test --test-isolation=none` → **110 passed, 0 failed**, final run exit 0. Initial full run before the additional equity-domain regression passed 109/109. Focused proposal run after its repair passed **10/10**.
- New module tests first failed with expected missing-module errors. A high-deposit/high-income regression then reproduced a capped-at-ask recommendation with invalid equity; the guard repaired it and the regression/full suite passed. Two initial test-only expectations were corrected to the existing `noiAnnualKrw` schema and literal blank-input session storage.
- Tests cover exact range statuses/caps/ordering, independently recalculated endpoint IRR/DSCR, comp median and land-pyeong units, engine-at-ask equality, deep deposits, scenario costs/downtime, input immutability, null IRRs, summary/no-debt/no-comp cases, and the invalid-equity recommendation guard. Minimal-DOM integration covers both audiences, section/chart construction, literal broker edits, session retention/default/disposal, one print dispatch, source inspection, picker/selected/missing buildings, load failure and invalid-funding wording. CSS assertions check A4, section breaks, hidden controls and repeating headings. These are not native browser/print rendering tests.
- `node verify/step09-check.mjs`: **400 buildings / 25 detailed records / 2,000 scenarios**, all baseline NOIs reconciled, all 400 default bid ranges satisfied their endpoint IRR/full-period DSCR checks. Scenario IRR statuses: **1,079 ok / 492 no_solution / 429 ambiguous**. Every unavailable IRR remained null. Representative Node proposal-analysis timing: median **43.4 ms**, max **67.5 ms**; not browser/device latency.
- Same check served **72 assets** under `/demo/` with HTTP 200, byte-identical content, correct JS MIME, valid UTF-8/no BOM and every asset below 1 MB. Temporary loopback server closed in `finally` and reported `serverClosed: true`.
- Independent read-only review found no confirmed Critical/Important/Minor findings. It explicitly declined actual A4 pagination, clipping, font rendering and browser-specific printing without a browser. Author added and repaired the invalid-equity adversarial test afterward; final suite verified the change.
- Final post-fix inventory/HTTP rerun retained **400 exact valid ranges, 2,000 scenarios with identical IRR status counts and 72 passing assets**; server closed. Node timing varied to median **41.7 ms**, max **90.1 ms**. Final PowerShell/.NET byte audit of all **13 changed/verification text files** confirmed valid UTF-8, no BOM, each below 1 MB and resolved paths within this worktree.
- Computer Use browser inventory returned `The browser access host is unavailable` with no browser tabs. No native app was controlled; no screenshots, console checks, visual responsive-layout or actual print-dialog verification is claimed.
- `git diff --check` passed with LF/CRLF normalization warnings. All work stayed inside this worktree; no git mutation commands, installs, external network resources or persistent servers. Runner owns commits.

### Known issues

- Actual A4 fit/pagination, fonts, clipping, native print dialog, browser console, keyboard/screen-reader behavior and responsive rendering remain unverified because browser access is unavailable. Sections have explicit print breaks and flowing content; physical page count can vary with browser/printer settings. Section indexes do not claim physical page numbers.
- Proposals use their disclosed baseline plus current Radar LTV/target, not unsaved bid/value-up edits. Broker name persists only during the application session; there is no immutable report storage/version snapshot or file export beyond native printing.
- Comparison and recommended ranges are disclosed demo conventions, not real appraisals, seller acceptance predictions or investment recommendations. Existing conservative IRR handling, generic summary assumptions and engine exclusions remain in force.

### UNKNOWNs

- Actual market dates/levels, verified rent/leases/deposits/expenses, lender underwriting/deposit deductions, transaction-specific taxes/VAT, building condition, executable construction budgets/delays, tenant consent and permitted uses. All seven reference UNKNOWNs remain unresolved.
- Actual browser/printer layout, native interactions, accessibility output, console and device latency. No real customer, owner, tenant or lot-level records were accessed.

## Step 10 — Integrated verification and fixes (2026-11-12)

### Done

- Reviewed the integrated shell/router, data loading, scene entry links, native ES-module imports, local resource paths, Korean copy, responsive/print styles and numerical conventions. No dependency, generated inventory or calculation-engine formula changes were needed.
- Fixed an empty `강남 사옥용` preset: its 10-minute walking limit excluded every positive-return eligible example. The preset now visibly specifies 12 minutes, yielding two candidates while preserving the 80억 equity budget, 0% target IRR, Gangnam/use gates and the full matching logic. Default and Seongsu presets retain three and one matches respectively. Synthetic prices/rents were not changed to produce matches.
- Fixed inconsistent BUY/WALK-AWAY labels: the price ruler rounded a 19.6685억 ceiling to 19.7억 while the ceiling card showed 19.6억. Both now use a shared 0.1억 round-down formatter, including the SVG description. Chart positions and comparison percentages retain full calculation precision; the Korean explanation distinguishes positions from labels. Proposal ceilings keep their disclosed 0.01억 round-down precision.
- Added durable cross-scene checks for all 25 detailed buildings at 0%, 50% and 80% LTV: Radar summary funding/IRR versus detailed bid inputs, proposal baseline/BUY equality, all three default value-up/proposal scenarios, capex/downtime and recommended endpoint IRR/DSCR. Preset checks prevent a dead-end demo; the real bid-view smoke test checks ruler/card agreement.
- Wrote `docs/DEMO_SCRIPT.md`: Korean **9-minute-15-second** order, local launch instructions, exact route shortcuts, verified sample values, presenter wording, assumption/rounding explanations, audience switching/printing and fallback paths. The main detailed example is `bld-songpa-003`, intentionally introduced through `조건 외도 보기` because its at-ask IRR misses the 8% target.

### Files

- `web-v2/js/radar.js`
- `web-v2/js/ui/format.js`, `web-v2/js/ui/bid-charts.js`, `web-v2/js/ui/bid-view.js`
- `tests/integration.test.mjs`, `tests/smoke.test.mjs`
- `docs/DEMO_SCRIPT.md`, `docs/PROGRESS.md`
- Verification-only, gitignored: `verify/step10-check.mjs`, `verify/step10-diagnose.mjs`, `verify/step10-demo-numbers.mjs` and small text/empty DOM files from the server/Edge attempt. No screenshots, images, PDFs or other deliverable binaries were created.

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read `docs/PLAN.md` first, Step 0 analysis and progress; inspected only relevant code/contracts in this worktree. Initial `git status --short` was clean. No excluded files, historical main-tree links, real records or secrets were opened.
- Requested `node --test tests/`: **exit 1, `spawn EPERM`** from the sandbox worker restriction. This command did not pass.
- Full alternative: `$testFiles = @(Get-ChildItem -LiteralPath tests -Filter '*.test.mjs' -File | ForEach-Object { $_.FullName }); & '<bundled-node-path>' --test --test-isolation=none @testFiles` → **112 passed, 0 failed**, exit 0 across all **12 test files**. Initial baseline was 110/110. The new preset test failed with `gangnam-office` before its repair; the bid-view regression failed with `'19.7억' !== '19.6억'` before the shared formatter fix. Focused post-fix integration/Radar run passed 7/7; smoke run passed 12/12.
- `node verify/step10-check.mjs`: actual app module bootstrapped in a minimal DOM harness and checked **179 normal route/view cases**, four missing-building routes, unknown-route fallback, **181 distinct generated links**, all 25 detailed records and one summary-only record per district across overview/bid/value-up/buyer/seller views. Also verified stale async-route suppression, a 503 deep-load failure followed by the actual Retry button, evidence-toggle persistence and cached local data requests. **72 web assets** passed UTF-8/no-BOM/sub-1MB checks. This is in-process integration, not a native browser or rendering test. An initial harness assertion expected a route title rather than the actual value-up heading; only the harness expectation was corrected.
- `node verify/step09-check.mjs`: **400 buildings / 25 detailed records / 2,000 scenarios**; all 400 default proposal ranges passed endpoint IRR/full-period DSCR checks, all baseline NOIs reconciled and unavailable IRRs remained null. IRR statuses remained **1,079 ok / 492 no_solution / 429 ambiguous**. Node analysis timings were median 44.5 ms/max 153.1 ms during concurrent verification; not browser/device latency claims.
- The same asset check served **72 assets under `/demo/`**, each HTTP 200, byte-identical content, correct JavaScript MIME and valid UTF-8/no BOM/below 1 MB. Its ephemeral loopback server closed in `finally`, reporting `serverClosed: true`.
- Started the explicitly supplied runner helper in a hidden background process: `node C:\Users\nicho\Dev\RealEstate-v2-run\serve.mjs web-v2 4199`. Root HTTP request returned **200**. Tried installed Edge with `--headless --disable-gpu --dump-dom --virtual-time-budget=10000` for `#/`, `#/radar` and `bld-gangnam-001` bid/value-up/buyer-proposal routes. All five DOM outputs were empty. Edge stderr reported **Windows access denied (0x5), fatal Mojo platform-channel initialization and Crashpad failures**; no successful page rendering is claimed. The server was stopped; final checks confirmed the original server PID absent and **no listener on port 4199**.
- `git diff --check` passed (only LF/CRLF normalization warnings). No git mutation commands, installs, external resource dependencies or intentional edits outside this dedicated worktree. Runner owns commits.
- Independent read-only code review found no confirmed Critical, Important or Minor findings. The reviewer reconciled the 3/2/1 preset counts, demo baseline metrics, BUY ceiling, proposal range, intervention defaults and route/label flow; its focused integration/smoke run passed **14/14**, exit 0. It retained native browser/console/print QA as UNKNOWN.
- Final byte/path audit checked all **eight deliverable files plus three verification scripts**: every resolved path stayed inside this worktree, valid UTF-8, no BOM/replacement characters and each file below 1 MB. Largest changed file was this progress log, approximately 74 KB.

### Known issues

- Native browser layout, JS console/runtime behavior, keyboard/focus/screen-reader behavior, A4 pagination/clipping and print dialog remain **UNKNOWN** because Edge could not initialize under the sandbox. Static CSS, minimal-DOM and HTTP checks do not establish visual correctness. No console-error-free or browser-performance claim is made.
- Bid/value-up edits remain page-local and do not propagate to proposals; proposals use current Radar LTV/target plus disclosed baseline assumptions. The demo script explicitly resets edited scenes and explains this limitation. No immutable report storage, CSV import/edit workflow or backend persistence was added.
- All prices, leases, comps, coordinates and reference bands remain synthetic/unverified. Some operating scenarios legitimately have unavailable/ambiguous IRRs; no fabricated numeric substitutes were added. Existing conservative IRR policy, fixed-LTV underwriting assumptions and tax/financing exclusions remain in force.

### UNKNOWNs

- Native browser/print rendering, console state, real input-device/accessibility behavior and device performance.
- Real market observation dates/levels, verified leases/deposits/expenses, lender underwriting, transaction-specific taxes/VAT, achievable construction costs/delays, tenant consent, permitted uses and actual deal outcomes. The seven reference UNKNOWNs remain unresolved. No real customer, owner, tenant or lot-level address data was accessed.

## Step 11 — Korean summary and fresh test results (2026-11-12)

### Done

- Wrote a compact Korean `docs/SUMMARY.md` covering the conclusion, verified/unverified behavior, local launch commands, linked demo order, synthetic inventory, seven reference UNKNOWNs, four partner S questions, future GitHub Pages changes and evidence paths.
- Distinguished this step's fresh tests from Step 10's historical route/HTTP checks. Explicitly retained browser/print/accessibility/performance UNKNOWNs, page-local edits versus proposal assumptions, session-only state and missing CSV/persistence/immutable-report workflows. No application, test, data or deployment files changed.
- Documented the exact bundled Node plus runner `serve.mjs web-v2 4173`, Python HTTP alternative, URL/server shutdown and full in-process test command. Launch commands were not executed in this documentation-only step. Runner `logs` and `out` paths are references only; their external contents were not opened or verified.

### Files

- `docs/SUMMARY.md` (new, Korean).
- `docs/PROGRESS.md` (this appended section).

### Commands and results

All Node invocations used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- Read `docs/PLAN.md` first, then the supplied Step 0 analysis and full progress record, demo script and reference UNKNOWN definitions. Initial `git status --short` was clean. `rg --files -g AGENTS.md` found only the unrelated `plot-os-demo/AGENTS.md`; no instructions under that subtree apply to these documentation files. Historical main-tree links and excluded files were not opened.
- Required `node --test tests/`: **exit 1, `spawn EPERM`**, blocked before actual tests ran. Runner summary reports one failed directory wrapper and zero passes; this is not an assertion failure in the application suite.
- Full alternative: `$testFiles = @(Get-ChildItem -LiteralPath tests -Filter '*.test.mjs' -File | ForEach-Object { $_.FullName }); & '<bundled-node-path>' --test --test-isolation=none @testFiles` → **12 files, 112 tests passed, 0 failed, 0 cancelled, 0 skipped, 0 todo, exit 0**, duration about 14.39 seconds. No tests or implementation were changed. Checks cover deterministic data/units, engine arithmetic and boundaries, cross-scene consistency, evidence, proposals and minimal-DOM interactions; they do not establish native browser behavior.
- PowerShell/.NET summary audit: **PASS**, strict UTF-8/no BOM/no replacement characters, **4,889 bytes / 2,726 characters**, eight required sections, expected results/launch/evidence text and all four local linked targets present. `git diff --check` passed before this log append.
- Final two-file byte/path audit and `git diff --check`: **PASS**, both documentation files strictly UTF-8 without BOM/replacement characters, below 1 MB and within the worktree; exactly one Step 11 section. Read-only status showed only the new summary and appended progress log.
- No server, install, network call, git mutation, external-folder write, binary or screenshot creation. Only the two documentation paths inside this dedicated worktree were edited; runner owns commits.

### Known issues

- Exact directory-form test execution remains blocked by the sandbox worker restriction; the complete explicit-file suite passed in-process. No successful `node --test tests/` claim is made.
- Native browser/console/keyboard/accessibility/device performance and A4 printing remain unverified. Step 10's 179 route cases and 72 HTTP assets are historical evidence, not this step's rerun. No Pages workflow changes or deployment were performed.
- Summary is a compact Markdown handoff, not a rendered/paginated document; no exact physical one-page fit was verified. Runner logs/out contents and the supplied local launch alternatives were not inspected/executed this step.

### UNKNOWNs

- All seven reference UNKNOWNs remain: current market date/levels, deposit conversion rate, VAT, transaction-specific tax, actual owner opex, basement rent and exclusive/GFA ratio. Actual leases, lender/deposit treatment, construction cost/delay, permissions, tenant consent and commercial outcomes also require evidence.
- Pilot brokerage, willingness to pay/pricing model, S/K responsibility and approval split, data collection/access/retention/export policy. Summary includes questions for S; this step did not resolve them or introduce real client/owner/tenant/lot-level data.

## 2026-11-12 — v2-ui Step 01: design guide

- Added `docs/DESIGN_GUIDE.md`: Korean implementation guide for map/list/drawer layout, desktop/tablet breakpoints, typography, color/spacing tokens, components, score markers, number formatting, accessibility, error states and proposal printing. Persistent disclosure: 예시 데이터 · 실제 매물 아님.
- Extended `web-v2/css/tokens.css` with service tokens while retaining existing visual values. The app already loads this stylesheet first; no new import was needed. Full scene restyling and the documented, pinned Pretendard CDN link remain Step 04 work.
- Verified with bundled Node v24.22.1: `--test --test-isolation=none` with all 12 explicit `tests/*.test.mjs` paths: **112 passed, 0 failed**. Additional checks passed for UTF-8/no BOM, sub-1MB changed artifacts, exact Korean/Unicode-escape disclosure, 107 unique CSS tokens, resolved CSS variable references and stylesheet order; `git diff --check` passed. The first disposable stdin check hit PowerShell pipeline encoding on a Korean assertion literal; reran successfully with ASCII source and Unicode escapes. No product file encoding repair was needed.
- UNKNOWN: browser font/CDN/tile access, WebGL, actual responsive rendering/contrast and A4 output. This step adds design specifications; it does not verify the later map/photo integrations. No installs, binaries, remote operations or deployment.
- Local commit attempt stopped at `git add -A`: the sandbox denied creation of the linked worktree's Git index lock. No commit was created. Per runner instructions, leave these three text files for the runner to commit as `v2-ui step 01 design guide: OK`; no permission escalation or writes to the main checkout were attempted.

## 2026-11-12 — v2-ui Step 02: example photos

- Added `tools/gen-photos.mjs` and 32 original offline architectural SVG illustrations under `web-v2/assets/photos/` (960×720, 32–66 KB each), plus `manifest.json`, `LICENSES.md` and a generated JS catalog. Artwork is CC0-1.0; no downloaded photography, third-party assets, real brands or actual building references. SVGs are committable text; no binaries or packages were added.
- Added `js/photos.js` deterministic ID-based assignments for all 400 synthetic buildings, with four distinct illustrations for each of the 25 deep buildings. Added reusable `js/ui/photo.js` thumbnails/gallery, Korean alt text, lazy loading, 4:3 frames, `예시` badges, persistent `예시 사진 · 실제 매물 아님` captions and same-frame missing-image fallback. Wired Radar cards, the listings table and overview headers; galleries explicitly state that the illustrations are unrelated exterior examples, not views or physical facts of the assigned building. Financial data and calculations are unchanged.
- Added `tests/photos.test.mjs` and extended scene smoke checks. Final verification with bundled Node v24.22.1, `--test --test-isolation=none` and all 13 explicit test paths: **115 passed, 0 failed**. Confirmed byte-identical regeneration, all 400 mappings and existing manifest files, unique deep galleries, failure/disclosure behavior, UTF-8/no BOM/no replacement characters, sub-1MB text artifacts, 32 valid SVG XML files and 32 HTTP 200 image URLs. `git diff --check` passed. Independent read-only code review found no actionable issues.
- UNKNOWN: actual desktop/mobile rendering, visual polish, fallback pixel dimensions and browser accessibility behavior. Browser access host was unavailable; native Computer Use stopped because it could not verify Chrome's current URL. UI automation ended without interacting with the browser. Temporary local QA server was stopped and its script removed. No installs, remote operations, deployment, map/CDN or Pages changes.
- Local commit attempt: `git add -A` failed because the sandbox denied creation of the linked worktree index lock. No staging or commit occurred. Leave these text changes for the runner to commit as `v2-ui step 02 example photos: OK`; no permission escalation or direct main-checkout writes were attempted.

## 2026-11-12 — v2-ui Step 03: OpenFreeMap map

- Replaced Radar's schematic SVG with an optional MapLibre GL JS 4.7.1 CDN adapter and OpenFreeMap Positron. Its muted palette keeps score overlays legible. Added Korean symbol labels, Seoul bounds, matching-only clusters, context points, score/price labels, selected/hover outlines, example-photo popups and visible attribution. Home retains its compact SVG preview. Synthetic locations and illustrations remain clearly labeled as examples unrelated to actual parcels.
- Added `js/map/radar-geo.js`, `js/map/radar-map.js`, `css/radar-map.css`, `tests/radar-map.test.mjs` and `docs/context/ui-step03-map.md`; wired Radar cards, pagination, filters, keyboard focus and detail links. CDN JS/CSS load without blocking the list; missing resources/WebGL, tile errors and long loads have inline notices and retry. Stylesheet recovery survives route destruction; map teardown cancels observers, timers and stale cluster results.
- Verified with bundled Node v24.22.1 and all 14 explicit test paths using `--test --test-isolation=none`: **119 passed, 0 failed**. Regression checks cover coordinates, GeoJSON membership, unavailable scores, delayed mount, filters before style load, selection/popups, overlapping click targets, keyboard focus, missing CDN/WebGL, tile-error notices, stylesheet retry across route changes and cleanup. Independent review findings were repaired and regression-tested. Strict UTF-8/no BOM/replacement characters, intact Korean labels, sub-1MB text assets and `git diff --check` passed.
- Local HTTP returned 200 for seven affected runtime assets and a popup illustration. Pinned CDN JS/CSS and Positron HEAD requests returned 200; style JSON contained 19 text-symbol layers. Browser access host was unavailable: actual WebGL, Korean glyphs, tile rendering, desktop/mobile layout, touch and native keyboard usability remain **UNKNOWN**. No installs, binary assets, remote git operations, deployment or Pages changes; temporary HTTP server closed.
- Local commit attempt stopped at `git add -A`: sandbox denied the linked worktree index lock. No staging or commit occurred; leave these text changes for the runner to commit as `v2-ui step 03 openfreemap map: OK`. No escalation or direct main-checkout writes were attempted.

## 2026-11-12 — v2-ui Step 04: UI restyle

- Restyled `web-v2/index.html`, shared tokens and new `css/service.css`: 56px Korean navigation, functional global search, selection-aware analysis links, account/menu placeholder, consistent scene tabs/breadcrumbs, restrained teal surfaces, readable labels, tabular numbers and compact tables. Added the pinned optional Pretendard stylesheet with system-font fallback. Home now also uses the Step 03 OpenFreeMap adapter rather than the schematic preview.
- Reworked `js/ui/radar-view.js` into horizontal condition menus, a left thumbnail list, an expanding map and a right selected-building drawer. Preserved all presets, sliders, sort, pagination, financial evidence and condition/context membership. Drawer opening/closing preserves the map instance and filters; queued/responsive map padding is recalculated. Below 768px native modal behavior supplies focus containment, background inertness and Escape dismissal.
- Updated overview, Max-bid, Value-up, Evidence and proposal presentation without changing engines, generated data or financial formulas. Added direct numeric slider entry with draft-safe typing, bounds/step validation, reset/disabled synchronization. Buyer/Seller reports have a labeled example illustration cover, shared Unicode-escape example-data footnote and A4 portrait/12mm print styling. Existing assets remain generated architectural SVG illustrations, not real building photographs.
- Added a shared `js/scenes.js` dispatcher and six meaningful smoke/interaction tests in `tests/ui-restyle.test.mjs`; updated map, evidence and exact CDN allowlist tests. Independent read-only review found four Important interaction issues; each was reproduced, repaired and regression-tested. No review findings were deferred.
- Verification: bundled Node v24.22.1, `--test --test-isolation=none` with all **15 explicit test-file paths: 125 passed, 0 failed**, exit 0. Temporary loopback audit served **113 assets**, all HTTP 200 and byte-identical with correct MIME, strict UTF-8/no BOM/no replacement characters/sub-1MB; Korean disclosure intact and CSS variables resolved. Core text contrast ratios: body 14.97:1, muted 5.78:1, teal 4.94:1, navigation 10.30:1. These checks establish source/asset contracts, not native rendering. QA script/output are ignored under `verify/`; server closed.
- UNKNOWN: actual 1024/1440/1920px rendering, native keyboard/touch/modal behavior, live WebGL/tiles/Korean glyphs/font loading and A4 pagination. Browser host was unavailable; Windows Computer Use stopped because it could not verify the browser URL. No further browser automation was attempted. All underlying market/lease/location/financing UNKNOWNs remain unchanged. No installs, binary files, remote git operations, deployment or Pages changes.
- Local commit attempt: `git add -A` failed with permission denied on the linked worktree index lock. No staging or commit occurred. Leave the verified text changes for the runner to commit as `v2-ui step 04 ui restyle: OK`; no escalation or direct main-checkout edits were attempted.

