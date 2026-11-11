Read-only review complete. No files changed, builds/tests run, services started, or excluded files/data opened. **v2 coverage below describes PLAN.md’s intended behavior, not verified implementation.**

1. **Product and business context**

   PLOT OS helps users decide **what price and conditions make a Seoul commercial-building deal workable**, with calculations, evidence, risks, and next actions. Initial assets are roughly ₩3–15 billion small/mid-sized income-producing buildings.

   The business documents describe an execution-led funnel: free Quick Check → paid expert report → brokerage, negotiation, remodeling, and development. Proposed report prices are ₩490,000–990,000; these are hypotheses. S supplies market judgment, clients, fieldwork, and execution relationships; K supplies software, data, and analysis.

   The newer PRD prioritizes **brokerage-firm workflow software and subscriptions**: proposed team/firm subscriptions of ₩300,000/₩700,000 monthly, plus onboarding. This commercial shift needs alignment with S. Sources: [business overview](/C:/Users/nicho/Dev/RealEstate/idea_scaffolding/business_overview.md), [README](/C:/Users/nicho/Dev/RealEstate/README.md), [PRD](/C:/Users/nicho/Dev/RealEstate/1101_작업/PLOT_OS_PRD_v0.1_2026-11-01.md).

2. **PRD P0 scope and planned v2 coverage**

   P0’s core deliverable is **CSV → review → real calculation → persistent storage → reproducible printed report**.

   | PRD P0 requirement | Coverage promised by v2 PLAN |
   |---|---|
   | CSV import, mapping, unit confirmation, validation, manual correction | Unspecified; v2 starts with generated JSON |
   | Property registration/editing/search, dates, persistent DB | Radar/detail browsing covers presentation; editable records and DB persistence unspecified |
   | Unit rent roll: area, occupancy, deposits, rent, expiry | Deep rent rolls for 25 buildings; editing/versioning unspecified |
   | Monthly NOI, equity, DSCR, IRR, equity multiple | Strong coverage; adds amortization, unlevered returns, payback |
   | Income-based price range | Value calculations planned; pricing methods must remain distinguishable |
   | Area vacancy, 12-month expiry share, tenant concentration | Occupancy and expiry visualization planned; exact required aggregates incomplete/unspecified |
   | Base/conservative/improvement scenarios, compare/save/restore up to three | Value-up comparisons planned; saved scenario lifecycle unspecified |
   | Acquisition/holding/sale costs and explicit omissions | Acquisition/selling costs planned; holding costs, tax status, VAT and omission handling incomplete |
   | Immutable report tied to analysis/input/engine versions | A4 proposal and evidence appendix planned; immutable snapshots unspecified |
   | Rules-based explanations, provenance, honest states | Strong evidence-trace concept; PRD verification fields and publication gates need additions |

   Radar, max-bid, sensitivity grids, extensive mock inventory, and sophisticated value-up scenes expand beyond P0. They do not replace its import, persistence, and snapshot requirements.

3. **Backend calculation logic worth porting to JS**

   [backend/analysis.py](/C:/Users/nicho/Dev/RealEstate/backend/analysis.py:3) is the useful foundation: validated assumptions, deterministic DCF, NPV, conservative IRR handling, and explicit limitations.

   Using purchase price `P`, LTV `L`, acquisition-cost rate `a`, renovation `C`, annual rent `R`, growth `g`, vacancy/loss `v`, annual opex `O`, interest rate `i`, holding years `H`, exit cap `c`, selling-cost rate `s`:

   | Calculation | Existing formula |
   |---|---|
   | Loan / initial equity | `D = P×L`; `E = P×(1+a) − D + C` |
   | Annual interest | `I = D×i`; fixed interest-only debt |
   | Year `y` NOI | `R×(1+g)^(y−1)×(1−v) − O` |
   | Annual equity operating cashflow | `NOI_y − I` |
   | Exit value | `max(0, [R×(1+g)^H×(1−v)−O] / c)` |
   | Final cashflow | Operating cashflow + `exitValue×(1−s) − D` |
   | NPV | `Σ CF_t/(1+r)^t` |
   | Cash-on-cash / DSCR | First-year operating cashflow ÷ equity; first-year NOI ÷ annual interest |

   Defaults: **50% LTV, 4.6% interest, 12% loss, five years, 2% annual rent growth, 4.5% exit cap, 11% target IRR, 4.6% aggregate acquisition cost, 1% selling cost**, zero renovation. These are model assumptions; the acquisition rate is not an itemized tax calculation.

   Important porting changes:
   
   - Replace annual periods with monthly, month-end cashflows; annualize monthly IRR with `(1+r_month)^12−1`.
   - Add inherited deposits to initial funding and exit settlement; the existing model excludes deposits entirely.
   - Existing renovation occurs upfront; opex stays flat; downtime, amortization, management income, ongoing capex, income/capital-gains tax are absent.
   - Existing `irr()` uses bisection and rejects **any negative subsequent cashflow**, including some solvable cases. Retain explicit failure states, but implement v2’s broader solver and detect ambiguous roots.
   - Existing exit NOI is clamped at zero; make unsupported/invalid exit assumptions explicit. DSCR returns `None` without interest; preserve “not applicable.”
   - Preserve unrounded calculation values and define consistent Python/JS rounding. Existing cash-on-cash and DSCR already consume rounded annual outputs.

   [backend/tests/test_backend.py](/C:/Users/nicho/Dev/RealEstate/backend/tests/test_backend.py) provides useful IRR, debt repayment, rate sensitivity, validation, and persistence examples, but no PRD monthly/deposit benchmark. Add the PRD’s independent annual and monthly cases separately: annual flows `[-30, .9, .9, .9, .9, 27.3]` in 억원 yield approximately **0.63005% IRR**, **1.03× multiple**, and **1.60 DSCR**.

   Other reusable ideas: `db.py` stores input/result JSON and ingestion provenance; `providers.py` normalizes upstream 만원 prices with `×10,000`. Public-data ingestion belongs outside the offline v2 engine.

4. **Existing frontend notes**

   Structure: React 19.2/Vite 6.4.2, Recharts, Phosphor icons; `src/main.jsx`, one 869-line `src/App.jsx`, `styles.css`, public images, plus Sites worker/packaging/tests.

   [App.jsx](/C:/Users/nicho/Dev/RealEstate/plot-os-demo/src/App.jsx:79) implements landing and report screens with sliders, three scenarios, print, share, and an expert-review modal. **IRR is a linear offset formula; scenario values use fixed offsets; the cashflow chart is hardcoded.** These formulas should be replaced.

   Landing inputs never reach report assumptions; loading stages are timers. “Save” only changes component state; sharing copies `#report` without assumptions. Navigation recognizes the initial hash but lacks a full router/history listener. The frontend never calls the backend.

   Useful presentation patterns include the assumption panel, scenario table, risk chips, responsive layouts, focus styling, and reduced-motion support. Current styling is cream/forest green; v2 specifies navy/light cards. Existing print CSS is minimal, without an A4 report structure.

   Backend structure is `analysis.py`, `db.py`, `providers.py`, `main.py`, separate `console.html`, and tests. Its APIs support transactions and saved deal calculations, without the PRD’s property/rent-roll/import/scenario/report lifecycle. Literal `?` corruption remains in console/test strings and the README’s appended backend paragraph, matching HANDOFF’s warning.

5. **GitHub Pages workflow and later deployment change**

   The only workflow is [deploy-pages.yml](/C:/Users/nicho/Dev/RealEstate/.github/workflows/deploy-pages.yml:1). It runs manually or on `main` pushes affecting `plot-os-demo/**` or itself.

   It uses Node 22, runs `npm ci --no-audit --no-fund`, then `npm run build` inside `plot-os-demo`. That command runs Vite and Sites packaging. Vite uses relative base `./` and outputs `dist/client`; packaging also creates worker/hosting artifacts.

   **Pages uploads only `plot-os-demo/dist/client`**, then deploys it through `actions/deploy-pages@v4`. The backend and Sites worker are not deployed. The documented public URL is `https://oni-nick.github.io/RealEstateProject/`.

   Later, deploying v2 requires changing the artifact path to **`web-v2`**, adding `web-v2/**` to triggers, removing the React install/build requirements, and adjusting/removing the default working directory and npm cache settings. If CI generates data or runs engine tests, include their paths in triggers and retain Node for those steps. Keep relative asset/data paths and hash routing. **No workflow changes made.**

6. **Risks and questions for partner S**

   - **Commercial priority:** brokerage subscription, report-led execution business, or both? Who pays first, and which repeated task earns that payment?
   - **Market calibration:** which first district/asset type, representative rent rolls, floor rents, loss assumptions, cap ranges, financing terms, deposits, fees, and remodeling downtime can S validate?
   - **Decision rules:** what target IRR, minimum DSCR, equity budget, and negotiation margin define BUY/WALK-AWAY? Fix LTV versus fixed-loan policy during price solving.
   - **Trust:** confidence badges need evidence and dates. Synthetic comps and expiry indicators must not imply verified valuation or vacancy probability.
   - **Accounting:** distinguish occupied rent from potential rent to prevent double-counted vacancy; distinguish refundable deposits, owner expenses, recoverable fees, capex, and taxes.
   - **Delivery:** calculating returns and price searches across ~400 buildings may need caching. Clarify “offline”: network-independent local serving versus reopening a previously hosted site without connectivity.
   - **Pilot readiness:** real-client handling requires the PRD’s access-control and data-rights gates. HANDOFF’s eight passing tests and five stored official samples are historical claims, not fresh verification; no database or provider access was performed.

7. **PLAN.md versus PRD conflicts**

   [PLAN.md](/C:/Users/nicho/Dev/RealEstate-v2-run/PLAN.md) calls itself authoritative for v2, but materially changes the PRD:
   
   - **Architecture:** zero-dependency static rewrite versus reuse React where possible, single API, and persistent DB.
   - **Acceptance:** demo hero scenes omit several mandatory P0 workflows; completing PLAN does **not** establish PRD P0 completion.
   - **Priority:** max-bid and sensitivities become central, while the PRD makes them P1 and cuts maps before core workflow.
   - **Tax:** approximate 4.6% acquisition tax versus user-entered costs, explicit unmodeled items, and no unsupported fixed-rate tax service.
   - **Evidence:** confidence/provenance tags omit PRD source locators, dates, verification identities/statuses, and input approval.
   - **Scope expansion:** amortizing debt and rent-growth/value-up mechanics exceed the PRD’s initial fixed-rate, interest-only model.

   Treat v2 as the **partner-meeting demo specification**, with the PRD retained as the separate workflow-alpha acceptance baseline until those differences are explicitly reconciled.