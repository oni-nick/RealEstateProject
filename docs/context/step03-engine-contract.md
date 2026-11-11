# Step 3 calculation engine contract

**예시 데이터 · 실제 매물 아님.** All defaults, generated building inputs and results
are unverified demo assumptions. This document defines arithmetic, not current
market conditions, investment advice, lender approval or transaction-specific tax.

## Entry point and units

Import from `web-v2/js/engine/index.js` in a browser or Node. The engine uses only
relative native ES module imports; its local `package.json` declares `type: module`.
There is no build, dependency, DOM, network, clock, random generator or persistence.
Functions preserve caller objects. Do not round values before calculation.

- Amounts: KRW. Rates: decimals (`0.05` means 5%). Income inputs: per month.
- Initial funding is at t=0; operations, debt service and deposit changes occur
  at each month-end. Sale occurs after the final scheduled monthly payment.
- `holdYears` defaults to 10, accepts 1–600 whole months expressed as years.
- `irr()` returns an annual effective rate when `periodsPerYear: 12`; its
  `periodicRate` is monthly. The standalone default is annual periods (`1`).

```js
import {
  inputFromBuilding, calculate, maxPurchasePrice,
  tornado, sensitivityGrid, valueUpScenario,
} from './engine/index.js';

const assumptions = inputFromBuilding(buildingSummary, optionalDeepRecord, {
  holdYears: 10, annualInterestRate: 0.05, ltv: 0.5,
});
const result = calculate(assumptions);
const irrPercent = result.metrics.leveredIrr.value === null
  ? null : result.metrics.leveredIrr.value * 100;
const prices = maxPurchasePrice(assumptions, { targetIrr: 0.08, minDscr: 1.2 });
const rateAndCap = sensitivityGrid(assumptions); // 3 × 3 default grid
const impacts = tornado(assumptions); // all five required levers
const leaseUp = valueUpScenario(assumptions, {
  type: 'lease-up', targetVacancyRate: 0.03,
  downtimeMonths: 3, capexKrw: 30_000_000,
  addedDepositsKrw: 20_000_000, // explicit new refundable liability
});
```

## Canonical inputs

`calculate(input)` and `normalizeInput(input)` require positive
`purchasePriceKrw`, nonnegative `monthlyPotentialRentKrw` and nonnegative
`monthlyOpexKrw`. Potential rent is the full building at the assumed rent level,
before vacancy/credit losses. A zero opex budget must be supplied explicitly.
`null`, `UNKNOWN`, strings, NaN, infinity and invalid ranges throw; they are never
coerced to zero. Optional inputs use the following explicit demo defaults.

| Field | Default | Meaning |
|---|---:|---|
| monthlyPotentialMgmtIncomeKrw | 0 | Potential collectible owner management-fee income; not pass-through expenses |
| vacancyRate | 0.12 | Rent-weighted income vacancy, before credit loss |
| creditLossRate | 0 | Additional loss on occupied rent/fees |
| annualRentGrowth | 0.02 | Annual step in rent and management income |
| annualOpexGrowth | 0 | Independent annual owner-expense step |
| ltv | 0.5 | Initial bank loan / candidate purchase price |
| annualInterestRate | 0.05 | Nominal annual interest; monthly rate = annual / 12 |
| loanType | interest-only | Alternative: `amortizing`, constant monthly payment |
| amortizationYears | 20 | 1–600 whole months; paid off if term ends before sale |
| depositsKrw | 0 | Inherited refundable tenant liabilities |
| initialCapexKrw | 0 | t=0 capital cost, outside NOI |
| annualCapexKrw | 0 | Recurring capex reserve/cost, paid in twelve equal parts |
| acquisitionTaxRate | 0.046 | Approximate demo allowance, not a legal tax calculation |
| acquisitionBrokerageRate | 0.005 | Purchase-price basis |
| acquisitionMiscRate | 0.003 | Purchase-price basis |
| loanFeeRate | 0.005 | Initial bank loan basis; levered model only |
| sellingCostRate | 0.005 | Gross exit-price basis |
| exitCapRate | 0.045 | Positive forward NOI capitalization assumption |

The current shared assumptions in `docs/data-sources.md` supersede historical
4.6% interest and aggregate 4.6% acquisition-cost defaults in Step 00. This port
keeps its deterministic NOI/DCF structure, 2% growth and configurable horizon,
but itemizes tax/brokerage/miscellaneous/loan fees. No current rates were retrieved.
General rate budgets are in [0, 1]; annual growth in [-0.99, 1]; exit cap is in
[0.000001, 1]. Amount budgets are limited to 1e16 KRW to reject unusable inputs.
`defaultsUsed` on a calculation identifies keys omitted from that call's input;
an already-normalized input contains defaults explicitly. Per-field assumption
provenance preserves their origin across normalization. Zero optional budgets
mean an explicit modeling exclusion, not evidence that actual costs are zero.

## Operating, loan and funding formulas

For month m, `yearIndex = floor((m-1)/12)`. First-year rent is flat; month 13 steps
up by annual growth. Owner opex follows its own growth rate and persists during
downtime. Rent loss, management income, deposits, capex and debt remain separate.

```text
potentialRent_m = basePotentialRent × (1 + rentGrowth)^yearIndex × completedUplift
vacancyLoss_m = potentialRent_m × [1 - (1 - vacancy) × (1 - downtimeShare)]
creditLoss_m = (potentialRent_m - vacancyLoss_m) × creditLossRate
rent_m = potentialRent_m - vacancyLoss_m - creditLoss_m
management_m = potentialMgmt × rentGrowthFactor × occupiedShare × (1 - creditLossRate)
NOI_m = rent_m + management_m - ownerOpex_m

loan = price × LTV
acquisitionCosts = price × (taxRate + acquisitionBrokerageRate + miscRate)
loanFee = loan × loanFeeRate
initialEquity = price + acquisitionCosts + loanFee + initialCapex - loan - deposits
unleveredInitialEquity = price + acquisitionCosts + initialCapex - deposits

interest_m = openingLoanBalance × annualInterestRate / 12
amortizingPayment = loan × monthlyRate / [1 - (1 + monthlyRate)^(-termMonths)]
zeroRateAmortizingPayment = loan / termMonths
principal_m = min(openingLoanBalance, payment - interest_m)
bankDebtService_m = interest_m + principal_m
leveredOperatingCF_m = NOI_m - capex_m + changeInDeposits_m - bankDebtService_m
unleveredOperatingCF_m = NOI_m - capex_m + changeInDeposits_m

exitForwardNOI = sum(NOI in months holdMonths+1 through holdMonths+12)
exitValue = max(0, exitForwardNOI / exitCapRate)
leveredNetExit = exitValue × (1 - sellingCostRate) - closingDeposits - remainingLoan
```

Interest-only loans keep all principal until sale; amortizing loans never service
principal twice. Final CF adds net exit to final operating CF. Exit value is an
income illustration; negative/zero NOI produces zero value plus a warning, not
an unsupported positive land value. Deposits reduce initial capital, never NOI;
they are deducted from sale proceeds to represent refund or buyer assumption.
They stay fixed unless an explicit intervention changes them. Unlevered returns
remove **bank** financing/fees; refundable tenant liabilities remain in both models.

The Step 1 funding example reconciles exactly: 100억 price + 4.6억 demo tax +
0.5억 brokerage + 0.3억 misc + 0.25억 loan fee − 50억 loan − 2억 deposits =
53.65억 initial equity, before capex and excluded VAT.

## Result and evidence schema

`calculate()` returns `assumptions`, `defaultsUsed`, `metrics`, `initial`, `exit`,
`cashflow`, `leveredCashflows`, `unleveredCashflows`, `warnings`, `status`,
`engineVersion`, and the Korean example-data label.

Every calculated amount/metric is `{value, formula, inputs, provenance}`. A
metric may additionally expose `status` and solver diagnostics. `value` is a raw
number, numeric cashflow array, or `null`; **never format null as 0**. Month/axis/
scenario identifiers and status labels are ordinary metadata. Formula text is
inline and sufficient to trace calculations; provenance includes its formula id,
engine version, `kind: derived`, `confidence: low`, `needsVerification: true`,
and `verificationStatus: not_verified`. Inputs include assumptions, source
provenance and relevant calculation dependencies. Caller confidence cannot
silently promote an engine result to verified market evidence.

`cashflow` contains months 1..N with evidence for potential rent, vacancy/credit
losses, collected rent/management income, opex, NOI, capex, interest, principal,
debt service/balance, deposits/change, operating CF, and total CF. The two wrapped
cashflow arrays contain t=0 through N, ready for charts and reproducibility.

| Metric key | Definition |
|---|---|
| noi | First-year NOI annualized if hold < 12 months |
| capRate | Annualized first-year NOI / purchase price (before acquisition costs) |
| equityRequired | Initial uses less bank loan and inherited deposits |
| cashOnCash | Annualized (first-year NOI − debt service − capex) / initial equity; excludes deposit flows and sale |
| dscr | First-year NOI / scheduled first-year bank debt service |
| minDscr | Minimum NOI/debt-service ratio across holding buckets of 12 months; final partial bucket included |
| leveredIrr | Annualized monthly bank-levered IRR |
| unleveredIrr | Annualized monthly property IRR before bank debt; tenant deposits retained |
| equityMultiple | Positive future distributions / (initial equity + all negative future CF capital calls) |
| paybackYears | First month-end cumulative equity CF ≥ 0 divided by 12, including sale; no interpolation |

DSCR is `null / not_applicable` without scheduled debt service (including a
zero-rate interest-only loan). Non-positive equity is `invalid_equity`; leverage
returns, cash-on-cash, payback and multiple are unavailable. Negative NOI/DSCR
remain negative. Payback that never occurs is `null / not_reached`.

## IRR and NPV

`npv(periodicRate, cashflows)` uses ordinary equal-period discounting with t=0
undiscounted. `irr(cashflows, options)` solves `NPV=0` in `x = log(1+r)` using
Newton, then bracketed bisection if Newton fails. Exponential scaling and removal
of initial/trailing zero periods avoid solver overflow/underflow. Scale does not
alter roots. Monthly IRR annualizes as `expm1(12 × log1p(monthlyIRR))`.

- Default periodic search interval: [-0.999999, 1,000,000], residual tolerance
  1e-12 relative to discounted absolute flows; limits 30 Newton / 200 bisection.
- Diagnostics: method, iterations, periodicRate and residual. Set
  `maxNewtonIterations: 0` to force bisection. Other options: `periodsPerYear`,
  `guess`, `minRate`, `maxRate`, `tolerance`, `maxBisectionIterations`.
- Flows: 2–1201 equally spaced finite amounts. Negative subsequent cashflows
  are allowed: e.g. `[-100, -10, 121]` has a valid unique solution.
- All-zero flows: `indeterminate`. No sign change: `no_solution`. Root outside
  bounds: `no_root_in_bounds`. Exhausted iterations: `not_converged`.
- More than one sign change: `ambiguous`, value null. A diagnostic 1024-interval
  logarithmic scan can reveal candidate sign-changing brackets, but cannot prove
  complete root enumeration or detect every tangent root. The engine withholds
  **all** such IRRs, even if a selected root seems plausible; it does not silently
  choose one. Target-rate NPV remains interpretable for separate review.

Independent tests include annual `[-30,.9,.9,.9,.9,27.3]` (~0.63005% IRR,
1.03× multiple), monthly compounding, 1.60 DSCR and separate amortization math.

## Maximum purchase price

`maxPurchasePrice(input, {targetIrr: .08, minDscr: 1.2})` returns evidence for
`atTargetIrr`, `atMinDscr`, combined `maxPrice`, `achievedIrr`, `achievedDscr`, and
`bindingConstraint` (`target_irr`, `min_dscr`, `both`, `infeasible`, `unavailable`).

Every candidate re-sizes the loan and purchase-based costs at **fixed LTV**.
The solver bisects target-rate NPV and the minimum annual-bucket DSCR separately;
the lower feasible price binds. The IRR boundary must have a demonstrably unique
IRR, as must the combined recommendation. Non-conventional flows return an
explicit unsupported/unavailable state rather than a supposedly precise bid.
DSCR's null/not-applicable state imposes no limit for a cash buyer or zero-rate
interest-only loan. Future declining income and downtime affect the DSCR ceiling.

The search excludes non-positive initial equity, expands its upper bracket, and
returns the feasible side within `priceToleranceKrw` (default 1 KRW). It supports
100% LTV when separate capex provides positive equity. A default ceiling of 1e15
KRW is a computational search bound, not a valuation cap. Reaching it returns
`above_search_bound` with `lowerBoundOnly: true`, not a proven maximum. Override
`searchBoundKrw` explicitly if needed. Infeasible domains/NOI return null.

## Sensitivity

`tornado(input, {ranges?, pricing?})` returns the base and rows sorted by absolute
IRR swing. Each row has low/high inputs, endpoint IRR and combined max price,
signed IRR changes from base, absolute IRR swing and max-price swing. Default
levers are interest rate ±1 percentage point, vacancy ±5 points, rent growth ±1
point, exit cap ±0.5 points and initial capex ±2% of purchase price (bounded at 0).
Each endpoint recomputes the whole model; it is not a linear approximation.

`sensitivityGrid(input, {xField, xValues, yField, yValues, pricing?})` returns
`cells[yIndex][xIndex]`. Defaults: rate [.04,.05,.06] on x and exit cap
[.04,.045,.05] on y. Each cell has wrapped IRR and combined max price. Fields
are restricted to the five tornado levers; axes must differ and hold 1–21 values.
Custom tornado ranges must contain two ordered endpoints. `pricing` forwards
max-price options. Null/bounded outcomes preserve statuses; swings requiring
unavailable or bounded endpoints are null.

## Value-up interventions

`valueUpScenario(baseInput, intervention)` compares one intervention against a
base without an existing intervention. `type` is `lease-up`, `remodel`, or
`use-change`. Inputs: `startMonth` (1), `downtimeMonths` (0), `capexKrw` (0),
`rentUpliftRate` (0), `affectedShare` (1), `targetVacancyRate` (base vacancy),
and `addedDepositsKrw` (0). Parentheses show defaults; set leasing targets and
new deposits explicitly. `rentUpliftRate` applies to potential base rent weighted
by affected share; management fees do not automatically receive that uplift.

- Capex is paid once at startMonth. Recurring capex continues separately.
- Completion month = startMonth + downtimeMonths. Effects begin that month.
- Lease-up retains existing occupied income during the leasing period, then
  changes vacancy/collects explicit additional deposits. It cannot increase vacancy.
- Remodel/use-change remove affected-share rent and management income during
  downtime, retain owner opex, refund affected inherited deposits at the start,
  and restore them plus any explicit new deposits on completion.
- With zero downtime there is no temporary refund; uplift starts immediately.
- Full-horizon IRR includes all costs, lost income, debt service, deposit flows
  and sale settlement. Negative or unavailable IRR changes are kept honestly.
- `before`/`after` NOI are the same forward twelve months starting at completion;
  their values use the same exit cap. `delta.value` is a gross income-value change
  before capex, while IRR captures actual capital spending and downtime.
- `beforeResult`/`afterResult` contain the complete models; `timeline` identifies
  downtime, affected share, capex and completion. An unfinished-at-sale project
  warns that forward exit income assumes modeled future completion.

Step 2 notes use `intervention`, `budgetKrw`, `downtimeMonths`, `rentUpliftRate`;
map the first two to `type`, `capexKrw` explicitly. Note text does not establish a
leasing target, a new deposit amount, construction feasibility or permitted use.

## Building adapter and remaining limits

`inputFromBuilding(summary, deep = null, overrides = {})` converts Step 2 data
without applying physical area vacancy to already-collected rent. With a deep
record it sums potential/contracted monthly rents, management fees, deposits
and annual owner expenses. Without it the same sums come from the summary.
Vacancy is `1 - collectedRent / potentialRent`. Potential management income is
collected management fees divided by the same collection share, explicitly a
projection assumption. All-vacant/no-management data gives zero potential
management income; nonzero fees with zero rent require an explicit separate
model rather than an invented gross-up. Historical capex is excluded.
Deep ids, required finite amounts and potential ≥ collected rent are checked.
Source provenance is retained; overrides are explicit. Tests reconcile all 400
summaries and all 25 details against the original NOI and funding figures.

UNKNOWN: real market levels, property evidence, actual lease renewal/credit
behavior, management recovery, future deposit negotiation, current lender
underwriting, construction quotes and use-change permissions. VAT, corporate/
income/capital-gains taxes, prepayment penalties, refinancing, actual lease
expiries and owner-specific taxation are excluded. The approximate acquisition
tax and mocked opex budget do not resolve those UNKNOWNs. This step implements
the engine/API only; UI wiring, browser interaction and reports are later steps.

Tests (bundled Node executable from PLAN.md):

```powershell
& 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe' --test tests/
# In this sandbox child-process isolation fails with spawn EPERM. Equivalent full suite:
& 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe' --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs tests/engine.test.mjs
```
