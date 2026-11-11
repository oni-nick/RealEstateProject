# Value-up simulator implementation plan

**Goal:** Implement PLAN scene 3 at `#/building/<id>/valueup` using the existing monthly engine.
**Architecture:** Pure scenario adapter/diagnostics, a focused view, and local SVG charts. No dependencies or engine arithmetic changes. One intervention at a time; toggling the selected plan off restores the base. This avoids implying that mutually overlapping works can be added together.
**Spec:** `docs/PLAN.md`, scene 3 and calculation-engine requirements.

## Constraints and decisions

- Existing dedicated worktree only; runner owns commits. No git mutations, installs, external network resources, binaries or real data.
- UTF-8 without BOM; every file below 1 MB. Example-data label remains visible.
- Lease-up reduces rent-weighted vacancy by an adjustable fraction; existing occupied income is never reduced twice. Remodel/use change use affected potential-rent share, explicit cost, downtime and uplift. All settings are unverified assumptions.
- Compare NOI and income value over the same 12 months from stabilization at the same cap rate. Gross value increase is before capex; IRR includes capex, downtime and refundable deposit changes.
- Floor strip describes the current rent roll, not an invented post-work floor allocation. Below-reference rent compares occupied rent/평 to 90% of the district reference midpoint, not a verified market appraisal. Basement and missing references are unknown. Expiry uses the synthetic snapshot and includes overdue leases.
- Deep value-up notes seed defaults. Summary-only records retain building-level scenarios with explicit missing floor-data state.

## Tasks and review focus

1. [x] Write failing pure tests for lease-up arithmetic, partial closure/downtime/cost/deposit cashflows, equal-date comparison, toggle-off identity, invalid/null IRR, negative chart domains, rent/expiry/reference heat flags and deep/summary inputs. Implement `web-v2/js/valueup.js`.
2. [x] Extend DOM smoke with plan toggles, live stable sliders, reset, evidence, summary/missing fallbacks and cleanup. Implement `ui/valueup-view.js`, `ui/valueup-charts.js`, app route and CSS.
3. [x] Run exact requested `node --test tests/`; if directory/worker limitations persist, run all explicit files in-process. Review numerical results across 400 buildings, all three plans and 25 heat strips; verify text sizes/encoding, subpath HTTP delivery and server cleanup. Append results and limitations to PROGRESS.

Review focus: no-vacancy/no-op plans; negative NOI and unavailable IRR; month boundary/zero downtime; vacant vs occupied flags and unknown expiry/reference; controls staying mounted and no updates after destruction.

Execution follows the supplied spec without approval pauses. User constraints supersede skill defaults for commits, worktree creation and artifact locations.

## Execution and review record

- Pure scenario tests and DOM smoke first failed on missing modules, then passed after implementation. Independent fixtures pin lease-up NOI +38.4m KRW/year, partial-work NOI +28.8m/year, downtime loss 38.4m and gross value +576m at 5% cap.
- Ruling: preserve the existing engine's conservative multiple-sign-change IRR policy. Test fixtures initially expected a numeric subtraction when one return was null; corrected those expectations after inspecting the engine's explicit `ambiguous` contract. Costs and downtime are never discarded to obtain a return.
- Full explicit-file in-process suite: 91 passed, 0 failed. Exact directory invocation failed with sandbox `spawn EPERM`; no directory-command pass is claimed.
- Separate read-only review: no Critical/Important findings. Fixed both minor findings: invalid numeric rent/area remains unknown (regression observed failing, then passing); Korean explanation now discloses zero income value for nonpositive NOI and excludes land valuation. No deferred findings.
- `verify/step07-check.mjs`: 1,200 scenarios, 400 buildings, 25 detailed rolls, 314 units; 65 UTF-8/no-BOM assets served byte-identically under `/demo/`. Temporary loopback server closed in `finally`.
- Browser host unavailable. Native Chrome inspection was stopped because the current URL could not be established confidently; no further UI automation. Layout/native interaction/console are unverified.
