## Step 00 — Naver map and licensed photos (2026-11-12)

Naver Dynamic Map now loads optional local runtime configuration and the new Maps SDK (`ncpKeyId`). The existing MapLibre/OpenFreeMap renderer is retained as automatic fallback, with a Korean notice on missing configuration, auth failure, or loading timeout. Filters, matching-only local clusters, context points, selection/hover, photo popups, and attribution are preserved through the public adapter.

The active photo catalog contains 20 local licensed Unsplash exterior JPEGs, 800×600, each under 250 KB. Exact example disclosures and image-error fallback remain in use; source and creator details are in `web-v2/assets/photos/LICENSES.md`. Earlier SVG artwork remains unreferenced. Tests exclude private local configuration from source scanning/imports.

Live Naver authentication, tile rendering, and browser visual behavior: UNKNOWN. Historical results below describe earlier steps.

---
# PLOT OS v2 UI 검증 요약 · 2026-11-12

## 결론

후보 탐색 → 최대 매입가 → 밸류업 → 근거 추적 → 매수자·매도자 제안서가 연결된 정적 데모입니다. 서울 30–150억 상업용 빌딩 400개와 상세 임대차 25개는 **합성 데이터**이며 실제 매물이 아닙니다. **사진은 예시 이미지**로, 자체 생성한 건축 SVG 일러스트입니다. 실제 건물 사진이나 해당 건물의 외관 증거가 아닙니다. 실제 업무용 데이터 검증·저장 제품의 완성을 의미하지 않습니다.

## 변경 사항

- **디자인 가이드:** 지도·목록·상세 패널 구성, 색상·타이포·간격·점수·접근성·인쇄 기준을 문서화했습니다.
- **지도:** 홈과 Deal Radar에 CDN의 MapLibre GL JS 4.7.1 및 OpenFreeMap Positron을 연결했습니다. 군집·조건 외 점·점수·호가·선택 팝업과 출처 표시를 제공합니다. 건물 좌표는 합성이며 실제 필지와 무관합니다. CDN·타일·WebGL 실패 시 안내와 재시도가 표시되고 목록으로 검토를 계속할 수 있습니다.
- **사진:** 32개 예시 일러스트를 건물 ID로 결정적으로 배정하며, 상세 건물은 네 장을 보여 줍니다. 예시 고지·대체 텍스트·이미지 실패 처리를 포함합니다.
- **화면 정리:** 한국어 상단 탐색·검색·조건 메뉴·사진 목록·지도·선택 상세 패널, 장면별 탭과 제안서 인쇄 스타일을 정리했습니다. 이번 단계는 실행 안내를 고치고 worktree 내부 서버 및 자산 검사를 추가했습니다.

## 실행 방법

PowerShell에서 이 worktree로 이동한 뒤 실행합니다. 패키지 설치와 빌드는 필요하지 않습니다.

```powershell
Set-Location 'C:\Users\nicho\Dev\RealEstate-v2'
$plotNode = 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe'
& $plotNode scripts/serve.mjs
```

`http://127.0.0.1:4173/#/`로 접속하고 홈의 **딜 레이더 열기**를 선택합니다. 종료는 `Ctrl+C`입니다. 이번 환경에서는 4173 포트가 이미 사용 중이라 직접 기동은 `EADDRINUSE`로 종료됐습니다. 기존 프로세스는 건드리지 않았으며 HTTP 검사는 임시 loopback 포트에서 통과했습니다. 실행 전 본인이 관리하는 기존 서버의 포트 점유를 확인합니다. `file://` 직접 열기는 지원하지 않습니다. 지도에는 CDN과 타일을 위한 인터넷 연결이 필요합니다. 선택적 글꼴 연결 실패 시 시스템 글꼴을 사용합니다. 로컬 데이터·일러스트·분석·목록은 외부 지도 연결 없이도 사용할 수 있습니다.

## 테스트 결과

번들 Node **v24.22.1**, **16개 테스트 파일: 통과 128 / 실패 0 / 취소 0 / 건너뜀 0 / TODO 0**, 종료 코드 0입니다. 실행한 전체 명령은 위 `$plotNode` 설정 후 다음과 같습니다.

```powershell
& $plotNode --test --test-isolation=none tests/bid.test.mjs tests/building-overview.test.mjs tests/data.test.mjs tests/engine.test.mjs tests/evidence.test.mjs tests/integration.test.mjs tests/market-refs.test.mjs tests/photos.test.mjs tests/preview.test.mjs tests/proposal-view.test.mjs tests/proposal.test.mjs tests/radar-map.test.mjs tests/radar.test.mjs tests/smoke.test.mjs tests/ui-restyle.test.mjs tests/valueup.test.mjs
```

사진 배정의 결정성·manifest 파일 존재, 좌표·GeoJSON·지도 실패 처리, 실제 장면 디스패처의 경로 렌더링을 검사했습니다. 로컬 참조 경로가 모두 존재하고 자산 34개 모두 1,000,000바이트 미만입니다. 최대 자산은 `facade-21.svg` **65,514바이트**입니다. 서버로 텍스트·SVG·자료 115개를 HTTP 200·원본 바이트·MIME 일치까지 확인했습니다. UTF-8·한국어 고지·공백 오류도 검사했습니다.

## UNKNOWN

실제 브라우저의 화면 배치·콘솔·키보드·터치·WebGL·한국어 지도 글리프·A4 페이지 나눔은 이번에 자동 검증하지 못했습니다. 향후 CDN·타일 가용성과 일러스트의 사진 같은 현실감·사용자 수용성은 UNKNOWN입니다. 실제 시세·임대차·좌표·금융 심사·세금/VAT·공사비·인허가도 검증되지 않았습니다. HTTP 검사는 화면 렌더링 검증을 대체하지 않습니다.

## 검증 근거 경로

- [설계](DESIGN_GUIDE.md), [지도 구현 기록](context/ui-step03-map.md), [시연안](DEMO_SCRIPT.md), [단계별 기록](PROGRESS.md).
- `tests/photos.test.mjs`, `tests/radar-map.test.mjs`, `tests/smoke.test.mjs`, `tests/ui-restyle.test.mjs`, `tests/preview.test.mjs`, `scripts/serve.mjs`.
- `web-v2/assets/photos/manifest.json`, `LICENSES.md`, `tools/gen-photos.mjs`.
- 로컬 로그: `verify/ui-step05-tests.log`, `verify/ui-step05-audit.json`, `verify/ui-step05-preview.log` (`verify/`는 git 제외 경로이며 커밋되지 않습니다). 커밋에 남는 결과는 이 문서와 진행 기록입니다.

## 다음 단계 제안

실제 브라우저에서 1024·1440·1920px 및 모바일·인쇄를 확인하고, 오프라인·지도 차단 상황을 점검합니다. 일러스트의 시연 적합성을 검토한 뒤 필요하면 사용권이 명확한 예시 사진을 별도 승인 범위에서 검토합니다. 실제 업무 연결 전에는 검증 가능한 임대차·운영비·대출 자료와 저장·버전 관리 범위를 정합니다.

원격으로 푸시하거나 병합하거나 배포한 내용은 없습니다.
