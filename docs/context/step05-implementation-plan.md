# Step 5 — Deal Radar implementation plan

Spec: `docs/PLAN.md`, scene 1 and building overview. Execute inline in the existing
dedicated worktree. No git mutations, installs, external resources or real records.

- [x] Add tested investor matching, presets, bounded financial memoization, sorting
  and median KPIs in `js/radar.js`; extend session filters without changing the engine.
- [x] Replace the radar view with criteria, live controls, scored reasons, matching
  map states and a paginated sortable candidate list. Keep the existing map API.
- [x] Extend overview with criterion-consistent IRR/funding, complete rent roll,
  snapshot-based remaining-rent waterfall, synthetic comps and action links.
- [x] Run `node --test tests/`, use in-process isolation if sandbox spawning fails,
  check real-data integration, UTF-8/size/imports, review the diff and append progress.

Review focus: zero matches/null IRR; price-bound crossings; preset synchronization;
LTV cache invalidation versus physical-filter reuse; exact lease-date boundaries,
vacant units and conservation of waterfall rent; summary-only records; cleanup.

Implementation decisions: all criteria are hard match gates; score ranks fit using
financial headroom and six explicit checks, never valuation confidence. Defaults
use the first specified preset. Presets are fictional screening assumptions, and
do not model owner occupancy or apply a value-up intervention. Deep records use
the same summary-equivalent adapter assumptions. Lease expiry shows monthly rent
exposure relative to the data snapshot, without assuming actual tenant departure.

Verification: eight added analytical tests and expanded existing DOM smoke coverage;
77 total tests pass in-process. Exact isolated command fails with sandbox spawn
EPERM. All 25 deep waterfalls conserve rent and all linked comps resolve. 59 local
assets serve byte-identically beneath `/demo/` from a transient server that closes
in `finally`. Browser host unavailable; layout/console/print remain unverified.
