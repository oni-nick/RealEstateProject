# PLOT OS v2 — 데이터 출처와 참고 가정 (Step 1)

**예시 데이터 · 실제 매물 아님. 모든 수치는 검증 전 데모 가정이다.**

작성일: 2026-11-12. 작성일은 시장 관측일이 아니다. 관측 기준일: **UNKNOWN**.
사용자 지시에 따라 웹, API, 보고서, 고객 자료를 열람하지 않고 모델의 일반 지식으로
2024–2026 서울 소형·중형 상업용 빌딩 수준을 넓은 범위로 설정했다.
대출 시나리오는 2025–2026 맥락의 가정이며 2026년 11월 현재 조건이라는 주장이 아니다.
이 문서는 투자·대출·세무 자문 또는 감정평가가 아니다.

## 파일과 행 계약

- 기준 파일: [market_refs.json](../web-v2/data/market_refs.json), schemaVersion 1.0.0.
- 10개 구 × 6개 지표 = 60개 지역 행; 공통 가정 8개 행; 명시적 UNKNOWN 7개 행.
- 모든 행은 고유 id, value 또는 range {min, max}, unit, sourceIds, sourceNames,
  tag, confidence, verificationStatus, provenance, notes를 가진다.
- 모든 행의 tag는 정확히 `reference/approximate - verify`, confidence는 `low`,
  verificationStatus는 `not_verified`이다. low는 근거 미검증을 뜻하며 통계적 신뢰도가 아니다.
- provenance.kind는 `assumption`이며 assumptionId는 행 id다. 모델 지식을 관측 사실(ref)로 표시하지 않는다.
- sourceRole은 `verification_candidates_only`다. sourceNames는 **나중에 대조할 후보**이며
  해당 기관에서 이 수치를 확인했다는 뜻이 아니다. sourcesConsulted는 false다.
- sources의 URL·정확한 보고서 제목·발행일·조회일은 모두 UNKNOWN이다. 확인하지 않은 제목이나 URL은 만들지 않았다.
- 각 지역의 sharedRefIds는 공통 대출금리·LTV·보증금 배수 행을 가리킨다. 지역별 차이가 확인되었다는 의미가 아니다.
- demoDefault가 있는 행만 명시된 기본값을 쓴다. 범위 중간값을 자동으로 사실처럼 취급하지 않는다.
  UNKNOWN은 문자열 그대로 유지하고 계산 시 명시적 미지원/사용자 입력 상태로 처리한다. 0이나 임의 값으로 치환하지 않는다.

## 단위와 지표 정의

금액 저장 단위는 원(KRW), 비율은 소수다. 예: 0.05 = 5%, 0.046 = 4.6%.
표의 가격·임대료만 읽기 쉽게 만원 단위로 표시했다.
1평 = 400/121 m² ≈ 3.305785m²; 평 = m² × 121/400. 계산 중 반올림하지 않는다.

- **대지 평당가:** 토지와 건물을 합한 전체 매입가 / 대지 평수. 순수 토지가격이 아니다.
- **연면적 평당가:** 동일한 전체 매입가 / 지하층을 포함한 건축물대장 총 연면적 평수. 건물만의 가격이 아니다.
- **1F·상층부 임대료:** 전용 임대면적 평당 월 기본 월세. 상층부는 2F 이상 일반 사무실·근린생활시설이다.
  보증금 환산, 관리비, VAT, 권리금, 인센티브는 제외한다. 지하·옥탑은 포함하지 않는다.
  실제 계약의 전용/계약면적 기준은 반드시 다시 확인한다.
- **공실률:** 시점 기준 공실 전용 임대면적 / 전체 전용 임대면적의 합성 가정.
  공식 지역 공실통계, 신용손실률 또는 연간 임대수입 손실률과 같지 않다.
- **캡레이트:** 취득비용 전 전체 매입가 대비 1년차 예상 NOI. NOI는 공실과 소유자 부담 운영비를 차감하고
  대출·소득세·CAPEX를 차감하기 전이다. 보증금이나 차입금은 분모에서 빼지 않는다.

## 지역별 참고 범위

모든 행에 공통으로 tag = reference/approximate - verify, confidence = low가 적용된다.
아래 각 지표의 실제 행 id는 `<district id>.<metric key>`이며 전체 출처명·단위·근거는 JSON에 있다.
지표 키는 순서대로 landPricePerPyeong, gfaPricePerPyeong, retail1fRentPerPyeongMonth,
upperFloorRentPerPyeongMonth, vacancyRate, capRate다.

| 구 id · 이름 | 예시 생활권 (전 구 통계 아님) | 대지 만원/평 | 연면적 만원/평 | 1F 만원/전용평/월 | 상층 만원/전용평/월 | 공실 % | 캡레이트 %/년 |
|---|---|---:|---:|---:|---:|---:|---:|
| gangnam · 강남구 | 역삼동, 논현동, 신사동, 청담동, 삼성동 | 10000–25000 | 2500–6500 | 15–45 | 6–13 | 5–12 | 2–3.5 |
| seocho · 서초구 | 서초동, 방배동, 양재동 | 7500–18000 | 2000–5000 | 12–30 | 5–11 | 5–13 | 2.3–3.8 |
| songpa · 송파구 | 잠실동, 문정동 | 5000–12000 | 1500–3500 | 9–22 | 4–8.5 | 6–15 | 2.8–4.2 |
| mapo · 마포구 | 합정동, 연남동, 서교동, 공덕동 | 5000–14000 | 1500–4000 | 11–30 | 4–9 | 7–16 | 2.5–4 |
| seongdong · 성동구 | 성수동 | 7000–20000 | 2000–6000 | 13–40 | 5–12 | 5–14 | 2–3.5 |
| yongsan · 용산구 | 한남동, 이태원동 | 7000–20000 | 2000–6000 | 12–40 | 4.5–11 | 8–20 | 2.2–3.8 |
| jongno · 종로구 | 종로 일대 | 4000–13000 | 1200–3800 | 10–30 | 3.5–9 | 8–18 | 2.8–4.3 |
| jung · 중구 | 을지로 일대, 명동 | 5000–18000 | 1500–5000 | 12–45 | 4–11 | 8–22 | 2.5–4 |
| yeongdeungpo · 영등포구 | 여의도동, 문래동 | 3000–8500 | 1000–2800 | 8–20 | 3.5–8 | 7–17 | 3.2–4.8 |
| gwangjin · 광진구 | 화양동, 자양동, 구의동 | 3500–9000 | 1100–3000 | 8–22 | 3.5–7.5 | 7–16 | 3–4.5 |

대지·연면적 가격 후보: molit, seoul-open-data, rsquare.
임대료·공실 후보: kreb, broker-quotes.
캡레이트 후보: rsquare, jll-korea, cbre-korea, broker-quotes.
후보 기관의 자료가 이 숫자를 입증한 것은 아니다. 종로구와 중구는 별도 구로 분리했다.
광진구를 추가했으며 요청된 생활권을 포함한다. 구 평균 또는 특정 동 시세로 해석하지 않는다.

## 서울 공통 금융·보증금·취득/매각 비용

아래 원시값의 비율 단위는 소수다. 모든 행은 동일한 검증 필요 태그와 low confidence를 가진다.

| id | value 또는 range | unit | 데모 기본값 | 검증 후보 sourceIds |
|---|---:|---|---:|---|
| seoul.loan_interest_rate | 0.04–0.07 | ratio/year | 0.05 | lender-quotes |
| seoul.typical_ltv | 0.4–0.6 | ratio | 0.5 | lender-quotes |
| seoul.deposit_to_monthly_rent_months | 10–20 | months_of_monthly_base_rent | 10 | broker-quotes |
| seoul.acquisition_tax_rate | 0.046 | ratio_of_purchase_price | 0.046 | wetax |
| seoul.acquisition_brokerage_fee_rate | 0.003–0.009 | ratio_of_purchase_price | 0.005 | broker-quotes |
| seoul.acquisition_misc_cost_rate | 0.001–0.005 | ratio_of_purchase_price | 0.003 | broker-quotes, wetax |
| seoul.loan_origination_fee_rate | 0.002–0.01 | ratio_of_initial_loan | 0.005 | lender-quotes |
| seoul.sale_brokerage_fee_rate | 0.003–0.009 | ratio_of_exit_price | 0.005 | broker-quotes |

- 금리는 명목 연이율이며 월 이자는 잔액 × 연이율 / 12로 가정한다. 대출 실행비는 별도다.
- LTV 40–60%, 기본값 50%는 매입가 대비 단순 조달 가정이다. 규제 상한·승인 약속이 아니다.
  실제 담보평가, 보증금 공제, DSCR, 신용과 대출 조건서는 UNKNOWN이다.
- 보증금 = 계약 월 기본 월세 × 10–20개월, 기본값 10개월. 법정 전월세전환율이 아니다.
  보증금은 반환 의무가 있는 부채이므로 NOI 수익으로 더하지 않는다.
  인수 시 승계된 실제 보증금만 자기자본 필요액에서 차감하고, 매각/종료 시 반환 또는 매수인 승계로 정산한다.
  빈 호실에는 보증금을 생성하지 않는다. LTV와 보증금의 합이 과도하면 자금조달 오류로 표시한다.
- 취득 관련 세금 4.6%는 PLAN의 대략적 합산 예산 가정이며 검증된 법정 세율이 아니다.
  실제 과세표준·가산·중과·감면·법인/용도 조건은 UNKNOWN이다.
- 취득 중개 기본값 0.5%, 기타 취득비 기본값 0.3%는 매입가 기준이다.
  대출 실행비 기본값 0.5%는 최초 대출원금 기준으로 한 번만 적용한다.
  중개보수 범위는 협상 시나리오 가정이며 법정 상한을 확인한 수치가 아니다.
- 데모 합산 취득비 = 매입가 × (0.046 + 취득중개율 + 기타취득비율).
  예: 매입가 100억원, LTV 50%, 월세 2,000만원, 보증금 10개월이면
  대출 50억원, 승계보증금 2억원, 세금 4.6억원, 중개 0.5억원, 기타 0.3억원,
  대출 실행비 0.25억원, 최초 자기자본 53.65억원이다 (CAPEX·VAT 제외).
  산식: 100 + 4.6 + 0.5 + 0.3 + 0.25 − 50 − 2 = 53.65억원.
- 매각 중개 기본값 0.5%는 출구 가격 기준이며 취득비와 별도다. 양도 관련 세금·대출 중도상환비·기타 매각비는 포함하지 않는다.
- 별도 VAT/회수 여부, 보유세와 실제 운영비, CAPEX, 법인·소득·양도 관련 세금 등은 미확인이다.
  운영비가 0이라는 뜻이 아니며, 향후 명시적 가정/임대차 내역으로 보완해야 한다.

## 나중에 확인할 출처 목록 (이번 단계 열람 없음)

| source id | 출처명 | 사용 전 확인할 범위와 한계 |
|---|---|---|
| molit | 국토교통부 실거래가 공개시스템 (MOLIT) | Future check of reported building transactions; reconstruct land/GFA denominators and exclude unusual deals. |
| seoul-open-data | 서울 열린데이터광장 (Seoul Open Data Plaza) | Future check of geographic/building context; not evidence for these exact price or rent bands. |
| kreb | 한국부동산원 상업용부동산 임대동향조사 | Future check of retail/office rent and vacancy context; published samples and geography may differ from small whole-building assets. |
| rsquare | 알스퀘어 (RSQUARE) | Candidate commercial-market commentary; no exact report or row consulted. |
| jll-korea | JLL Korea | Candidate market context; institutional office evidence cannot be substituted directly for small-building rents or yields. |
| cbre-korea | CBRE Korea | Candidate market context; institutional office evidence cannot be substituted directly for small-building rents or yields. |
| lender-quotes | 거래 금융기관의 개별 대출조건서 | Obtain an actual lender quote for rate, LTV, collateral deductions, DSCR and fees. No lender or quote identified. |
| wetax | 위택스 (Wetax) / 관할 지방자치단체 세무부서 | Future confirmation of applicable acquisition taxes, additions, exemptions and taxpayer-specific treatment. |
| broker-quotes | 현지 공인중개사 확인 / 거래별 중개보수 견적 | Future check of small-building rents, deposits, operating expenses and negotiated brokerage fees; no broker consulted. |
| nts | 국세청 (National Tax Service) | Candidate for transaction-specific VAT and national-tax treatment; no guidance consulted. |

기관명은 출처의 일반 이름이다. 특정 보고서·발행일·표·URL 또는 거래 사례를 인용하지 않았다.
공식 자료의 지역/면적/표본/기간과 데모의 소형·중형 개별 빌딩 모집단이 다를 수 있다.
JLL·CBRE 등의 기관용 오피스 수치를 소형 빌딩의 직접 근거로 대체하면 안 된다.

## 명시적 UNKNOWN

모든 UNKNOWN 행도 id, unit, sourceNames, 검증 태그, low confidence와 assumption provenance를 가진다.

| id | value | unit | 검증 후보 sourceIds | 필요한 확인 |
|---|---|---|---|---|
| unknown.current_market_as_of | UNKNOWN | date | molit, kreb, lender-quotes | Actual transaction, rent, vacancy and loan observation dates/current November 2026 levels were not retrieved. |
| unknown.deposit_conversion_rate | UNKNOWN | ratio/year | broker-quotes | Actual negotiated or legally applicable deposit/rent conversion rate is not supplied. Do not infer an annual yield from the deposit-month multiple. |
| unknown.vat_treatment | UNKNOWN | tax_treatment | nts | Building/land VAT allocation, service VAT, business-transfer treatment and recoverability depend on the actual deal; not modeled by the simple acquisition allowance. |
| unknown.transaction_specific_tax_rate | UNKNOWN | ratio_of_taxable_base | wetax | Actual taxable base and combined tax rate depend on purchaser, property/use and applicable law; 4.6% remains only a demo allowance. |
| unknown.itemized_owner_opex | UNKNOWN | KRW/year | broker-quotes | Actual property tax, insurance, repairs, management and nonrecoverable operating expenses require property evidence. Do not reverse-engineer an asserted rent roll from the cap-rate band. |
| unknown.basement_rent | UNKNOWN | KRW/pyeong_exclusive/month | broker-quotes | No district-level basement rent assumption supplied; 1F and upper-floor bands must not silently fill B1. |
| unknown.exclusive_to_gfa_ratio | UNKNOWN | ratio | seoul-open-data, broker-quotes | Building-specific exclusive leasable area / total GFA is not supplied. Do not multiply exclusive-area rent directly by GFA. |

추가로 실제 소유자·호별 계약·실거래·대출 견적·관측일은 수집하지 않았으며 이 데이터에 없다.
이름은 구/동 수준의 지리 표기뿐이고 필지 주소, 실제 고객 및 소유자 정보는 포함하지 않는다.

## 다음 단계에서의 사용과 검증

1. 행 id와 confidence/tag를 향후 파생 값의 evidence trace에 보존한다. 미검증 상태를 상속한다.
2. 같은 가격 P를 사용해 대지 기준 P/대지평과 연면적 기준 P/연면적평을 계산한다.
   두 평당가를 독립 추출해 서로 다른 매입가를 만들지 않는다.
3. 전용 임대면적과 층별 임대료로 잠재 임대수입을 계산한다. 전용/연면적 비율은 별도 건물 가정이다.
   이미 공실이 반영된 rent roll에 공실률을 중복 차감하지 않는다. 공실률만으로 연간 손실을 단정하지 않는다.
4. 임대료·면적·공실·운영비에서 계산한 NOI와 매입가로 cap을 산출한다. 캡 범위는 타당성 점검용이며
   목표 cap에 맞추려고 NOI를 만든 뒤 관측 임대료라고 주장하지 않는다.
5. 매물 생성 시 별도 PLAN 조건인 30–150억원 가격 필터도 적용한다. 모든 범위 끝값 조합이 그 필터에 맞는 것은 아니다.
6. 생활권, 건물 상태, 도로·전면, 층 구성, 용도지역 등에 따른 편차가 크다. 범위는 분위수·신뢰구간·연도별 시계열이 아니다.
7. 파트너가 검증한 데이터로 교체할 때 실제 출처·기준일·면적 기준·조건을 기록한다. 검증 전에는 high confidence로 올리지 않는다.

## 폴더와 로컬 검사

`web-v2/index.html`은 예시 데이터 표시와 JSON 링크만 있는 시작용 placeholder다.
`web-v2/css/`, `web-v2/js/engine/`, `web-v2/data/`, `scripts/`, `tests/`를 후속 단계용으로 준비했다.
빈 폴더는 .gitkeep으로 보존한다. 기존 .gitignore의 verify/ 규칙을 재사용한다.
스크린샷·검사 산출물은 verify/ 안에만 저장한다. 외부 파일·폰트·라이브러리·CDN은 없다.

계약 검사는 Node 기본 test 모듈만 사용한다. 스키마, 단위, 범위, 고유 id, 출처 후보 표기,
UNKNOWN, 문서/JSON 수치 일치, UTF-8 BOM 및 파일 크기를 확인한다. 시장 수치의 정확성을 검증하는 검사는 아니다.

```powershell
& 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe' --test tests/
```

이 샌드박스에서 위 명령은 자식 프로세스 생성 시 `spawn EPERM`으로 실패했다.
동일한 검사를 자식 프로세스 없이 실행하는 명령:

```powershell
& 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe' --test --test-isolation=none tests/market-refs.test.mjs
```
