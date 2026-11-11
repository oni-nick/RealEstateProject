# PLOT OS v2 데모 요약 · 2026-11-12

## 결론

“고객이 얼마까지 제안할 수 있고, 무엇으로 설명할까?”를 후보 탐색 → 가격 한도 → 개선안 → 근거 → 제안서로 연결한 정적 데모입니다. CSV 입력·수정, DB 저장, 버전 고정 보고서는 미구현이며 업무용 P0 완성판은 아닙니다.

## 동작 범위와 검증 상태

- **이번 검증:** 번들 Node의 `--test tests/`는 `spawn EPERM`, 종료 1(테스트 실행 전 실패). 아래 대체 명령은 **12개 파일, 112개 통과 / 실패·취소·건너뜀 0, 종료 0**. 데이터 재현성, 월별 NOI·IRR·DSCR·보증금/대출 정산, BUY/WALK-AWAY·민감도·세 개선안·근거·양측 제안서·최소 DOM 연결을 검사했습니다.
- **기존 기록:** Step 10의 정상 경로/뷰 179개와 하위 경로 `/demo/`의 72개 자산 HTTP 검사는 통과했으나 이번에는 재실행하지 않았습니다.
- **미검증·제약:** 브라우저 차단으로 화면·콘솔·접근성·기기 성능·A4 배치/인쇄는 UNKNOWN. 개별 매수 한도가/밸류업 편집값은 제안서에 전달되지 않으며 제안서는 레이더 LTV·목표 IRR과 기본 가정을 사용합니다. 상태는 세션 한정이고 해 없음/모호한 IRR은 산출 불가입니다.

## 로컬 실행과 테스트

전용 worktree의 PowerShell에서 실행합니다. 설치·외부 인터넷은 불필요하며 `file://`는 미지원입니다.

```powershell
Set-Location 'C:\Users\nicho\Dev\RealEstate-v2'
$plotNode = 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe'
& $plotNode 'C:\Users\nicho\Dev\RealEstate-v2-run\serve.mjs' web-v2 4173
# 대안: Python이 설치되어 있다면 위 서버 대신 실행
python -m http.server 4173 --bind 127.0.0.1 --directory web-v2
```

서버 하나만 실행해 `http://127.0.0.1:4173/#/`로 접속하고 `Ctrl+C`로 종료합니다. 위 실행법은 이번에 미실행이며 Step 10에는 Node helper의 4199 포트 HTTP 200 기록이 있습니다.

```powershell
# 위 $plotNode를 설정한 별도 터미널에서 전체 테스트 대체 실행
$testFiles = @(Get-ChildItem -LiteralPath tests -Filter '*.test.mjs' -File | ForEach-Object { $_.FullName })
& $plotNode --test --test-isolation=none @testFiles
```

## 데모 순서

[9분 15초 진행안](DEMO_SCRIPT.md): 홈 → 레이더(기본/강남/성수 일치 3/2/1개) → `bld-songpa-003` 개요 → 매수 한도가 → 밸류업 → 근거 → 매수자·매도자 제안서 → S 논의. 본 건물은 IRR 미달로 **조건 외도 보기**에서 진입합니다. 현장 화면·인쇄 미리보기 사전 확인이 필요합니다.

## 예시 데이터와 UNKNOWN

**예시 데이터 · 실제 매물 아님:** 건물 400개, 상세 임대차/운영비/공사 이력 25개, 비교 거래 150개, 10개 구 개략 지도·위치/도보 시간, 참고 밴드·금융/세금/공사 가정은 모두 합성·미검증입니다. 실제 고객·소유자·임차인 이름이나 필지 주소는 없고 기관명은 검증 후보입니다.

일곱 기준 UNKNOWN: **시장 관측일/현재 수준, 보증금 전월세 전환율, VAT, 거래별 세율, 실제 소유자 운영비, 지하 임대료, 전용/연면적 비율**([자료 기준](data-sources.md)). 실제 계약·대출 심사/보증금 차감·공사비/기간·인허가·임차인 동의·거래 성과도 UNKNOWN입니다. 4.6% 세금 예산과 고정 LTV는 실제 세무·대출 판단을 대신하지 않습니다.

## 파트너 S에게 확인할 질문

- **파일럿 중개사:** 어느 중개사무소·지역·건물 유형과 어떤 반복 업무부터 검증할까요?
- **가격:** 보고서 건별 과금과 중개사무소 구독 중 무엇을 우선하며, 지불 의사와 유료 전환 기준은 무엇일까요?
- **역할 분담:** S의 현장·자료 검증/중개 실행과 K의 제품·계산/개발 책임, 최종 보고서 승인자는 누구일까요?
- **데이터/반출 정책:** 수집 권한·고객 동의·비식별화·보관/삭제·접근권한과 제안서/CSV 반출 범위를 어떻게 정할까요?

## GitHub Pages 후속 변경 · 배포 미실시

업로드 경로를 `web-v2`로 바꾸고 `web-v2/**`·검사 관련 `tests/**`·`scripts/**` 트리거를 반영해야 합니다. 기존 npm 설치/빌드·캐시·작업 디렉터리 설정을 정리하고 Node 테스트를 연결합니다. Pages 권한/환경·하위 경로 상대 링크/해시 라우팅·브라우저/인쇄 확인이 남아 있습니다. workflow 수정·게시는 하지 않았습니다.

## 근거 경로

[진행·검증 기록](PROGRESS.md), [테스트](../tests/). 러너 경로: `C:\Users\nicho\Dev\RealEstate-v2-run\logs`, `C:\Users\nicho\Dev\RealEstate-v2-run\out`(이번 단계에서 외부 폴더 내용 미열람·미확인).
