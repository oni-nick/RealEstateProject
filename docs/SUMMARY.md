# PLOT OS v2 데모 요약 · 2026-11-12

이번 Step 01은 기존 지도·사진 구현을 테스트하고, 기존 공개 데모를 보존하면서 v2를 별도 경로에 배포하도록 GitHub Pages 워크플로를 변경한 작업입니다. 앱은 npm 빌드가 필요 없는 정적 ES 모듈입니다. 별도 서버 실행, 커밋, 푸시, 브랜치 변경은 하지 않았습니다.

## 지도와 예시 사진

현재 구현은 선택적 런타임 설정을 읽어 Naver Dynamic Map을 불러옵니다. 새 Maps 상품의 SDK 매개변수는 `ncpKeyId`입니다. 설정 누락, 인증 실패, 로딩 시간 초과 시 MapLibre/OpenFreeMap 대체 지도와 한국어 안내를 표시합니다. 필터, 조건 일치 항목만의 군집, 주변 항목, 선택·호버, 사진 팝업, 출처 표시를 유지합니다.

예시 사진 풀은 로컬 Unsplash 외관 사진 20장으로 구성됩니다. 크기는 800 × 600이며 각 파일은 250 KB 미만입니다. 실제 매물 사진이 아니며 화면의 예시 고지를 유지합니다. 출처·촬영자·Unsplash License는 `web-v2/assets/photos/LICENSES.md`에 기록되어 있습니다. 사진은 로컬 파일로 제공됩니다.

## 자동 검증 결과

지정된 번들 Node로 전체 테스트 파일을 한 번 실행했습니다. 결과는 **총 134개, 통과 134개, 실패 0개, 취소 0개, 건너뜀 0개, TODO 0개, 종료 코드 0**입니다. Naver 로더·인증 실패·대체 지도·군집·선택과 사진 출처·데이터·계산·경로 검사를 포함합니다. 테스트에는 가짜 설정만 사용하며 실제 Client ID를 읽거나 기록하지 않았습니다.

실행 방식은 `tests` 폴더의 `*.test.mjs` 파일 목록을 수집한 뒤 `& $plotNode --test --test-isolation=none @testFiles`로 실행했습니다. 테스트 자체의 임시 HTTP 검사를 제외하고 별도 미리보기 서버를 시작하지 않았습니다.

## GitHub Pages 배포

- 기존 데모 유지: https://oni-nick.github.io/RealEstateProject/
- 새 v2 전용 주소: https://oni-nick.github.io/RealEstateProject/v2/

워크플로는 `demo/plot-os-v2` 브랜치의 관련 경로 변경 또는 수동 실행으로 동작합니다. `_pages_out/` 루트에는 기존 데모를, `_pages_out/v2/`에는 `web-v2/` 전체를 복사하여 스테이징 디렉터리 전체를 업로드합니다. 기존 빌드가 없으면 `gh-pages` 브랜치를 시도하고, 없으면 최근 성공한 Pages 워크플로의 보존된 아티팩트를 복원합니다. 복원할 기존 루트가 없거나 루트 `index.html`이 비어 있으면 배포를 중단합니다. 아티팩트 복원에 필요한 `actions: read` 권한을 추가했습니다.

v2 배포본의 index에만 `/RealEstateProject/v2/` base href를 설정합니다. 자산 경로는 상대 경로이며 `#/` 라우팅을 유지합니다. 로컬 원본 index에는 배포용 base를 추가하지 않습니다. `_pages_out/`과 로컬 비공개 설정 파일은 Git에서 제외됩니다.

Client ID는 GitHub secret **NAVER_MAPS_CLIENT_ID**에서 배포 시 `v2/local-naver-config.js`로 주입합니다. secret이 비어 있으면 파일 생성을 생략하고 대체 지도를 사용합니다. 실제 값은 문서·테스트·로그에 포함하지 않습니다.

## Nick의 콘솔 설정 및 로컬 확인

Naver 콘솔 Web 서비스 URL 목록에 **`https://oni-nick.github.io`**를 추가해야 합니다. 포트나 경로는 필요 없습니다. 등록하지 않으면 v2 Pages 지도는 대체 지도를 표시합니다. 로컬 등록 URL은 **`http://localhost`**, **`http://127.0.0.1`**이며 포트를 붙이지 않습니다. 로컬 미리보기 서버 실행은 러너가 담당합니다. 로컬 설정은 Git에서 제외된 `web-v2/local-naver-config.js`를 런타임에만 읽습니다.

## UNKNOWN

실제 브라우저 렌더링, Naver 실인증·타일 표시, 반응형 화면과 콘솔 상태는 자동 확인하지 않았으므로 **UNKNOWN**입니다. GitHub Actions 실제 실행, 이전 Pages 아티팩트의 현재 다운로드 가능 여부, 공개 URL의 배포 후 동작도 **UNKNOWN**입니다. 로컬 Bash 검사는 Windows 프로세스 실행 제한으로 실패하여 셸 실행 검증은 **UNKNOWN**입니다. 상대 자산 URL·배포용 base·해시 경로·UTF-8·업로드 경로·루트 보호 조건은 정적 검사로 확인했습니다. 이 단계에서는 공개 사이트를 배포하거나 변경하지 않았습니다.
