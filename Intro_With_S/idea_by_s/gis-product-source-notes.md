# GIS·중소형 빌딩 AI 제품 분석 소스 노트

기준일: 2026-07-30 (Asia/Seoul)

## 의사결정 질문

- 중소형 빌딩 AI 중개·컨설팅 제품에 GIS 데스크톱 프로그램이 필수인가?
- 공식 API와 공간 연산으로 어디까지 자동화할 수 있는가?
- 무엇을 먼저 검증하고, 어떤 순서로 제품화해야 하는가?

## 제공된 사업 맥락

- `idea_by_song/insight.md`: 대형 빌딩은 대형 부동산 회사가 주로 다루고, 소형·중소형 빌딩은 상대적으로 분산되어 있어 AI를 접목할 기회가 있다는 현업 가설.
- 이 문서는 정량 시장조사나 경쟁 공백의 증명이 아니라 방향 가설로 취급했다.

## 공식 데이터·기술 소스

1. [국토교통부 건축HUB 건축물대장정보 서비스](https://www.data.go.kr/data/15134735/openapi.do): 건축물대장 기본개요, 표제부, 층별개요, 지역지구구역 등. JSON/XML, 월간 갱신.
2. [국토교통부 상업업무용 부동산 매매 실거래가 자료](https://www.data.go.kr/data/15126463/openapi.do): 법정동 코드와 계약년월로 조회. 일반건축물 지번은 개인정보 보호를 위해 일부만 공개.
3. [국토교통부 토지 매매 실거래가 자료](https://www.data.go.kr/data/15126466/openapi.do): 법정동 코드와 계약년월로 조회. 지번 일부 비공개.
4. [국토교통부 GIS건물일반집합정보(WMS/WFS)](https://www.data.go.kr/data/15123552/openapi.do): GIS건물통합정보와 세움터 건축물대장 속성을 융합한 도형·속성 피처.
5. [국토교통부 용도지역지구정보(WMS/WFS)](https://www.data.go.kr/data/15123895/openapi.do): 국토·기타 용도지역지구 공간정보.
6. [국토교통부 토지특성정보(WMS/WFS/속성정보)](https://www.data.go.kr/data/15123549/openapi.do): 토지이용상황, 지형고저, 지형형상, 도로접면 등 필지 특성.
7. [국토교통부 개별공시지가정보(WMS/WFS/속성정보)](https://www.data.go.kr/data/15124014/openapi.do): 필지별 단위면적당 개별공시지가 공간정보.
8. [국토교통부 지오코더 API](https://www.data.go.kr/data/15101106/openapi.do): 일 최대 40,000건이지만 결과를 별도 저장장치나 DB에 저장할 수 없다고 명시.
9. [주소정보누리집 검색 API](https://eng.juso.go.kr/addrlink/openApi/searchApi.do): 도로명주소 검색과 좌표제공 API. 좌표 API는 UTM-K(GRS80)를 사용하므로 별도 좌표 변환이 필요.
10. [SGIS Open API](https://sgis.kostat.go.kr/developer/html/openApi/api/intro.html): 통계청 공간통계·지도 API. 개발키 이후 상용키 전환 절차가 있음.
11. [PostGIS 공간 질의](https://www.postgis.net/docs/manual-dev/en/using_postgis_query.html): `ST_Intersects`, `ST_Within`, `ST_DWithin` 등 공간 인덱스 활용 질의.
12. [GDAL ogr2ogr](https://gdal.org/en/stable/programs/ogr2ogr.html): 공간 파일 변환, 재투영, 필터, 클립을 명령줄로 자동화.

## 규제·실무 경계

1. [건축법 제44조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025276907): 원칙적으로 건축물 대지는 2m 이상 도로에 접해야 한다.
2. [한국건축규정 체크리스트](https://www.law.go.kr/LSW/flDownload.do?bylClsCd=200201&flNm=%5B%EB%B3%84%ED%91%9C+2%5D+%ED%95%9C%EA%B5%AD%EA%B1%B4%EC%B6%95%EA%B7%9C%EC%A0%95+%EC%B2%B4%ED%81%AC%EB%A6%AC%EC%8A%A4%ED%8A%B8&flSeq=139972567): 건축허가 시 확인할 다수 법령·항목을 제시. 용도지역 하나만으로 개발 가능 여부를 확정할 수 없음을 보여준다.
3. [감정평가 및 감정평가사에 관한 법률](https://law.go.kr/LSW/lsInfoP.do?lsiSeq=179795): 타인의 의뢰를 받아 보수로 감정평가를 업으로 수행하는 영역과 감정평가업자를 정의.
4. [공인중개사법 제9조](https://law.go.kr/LSW/lsInfoP.do?lsiSeq=273341): 중개업을 영위하려는 자는 중개사무소 개설등록이 필요.
5. [공인중개사법 제14조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1032085293): 법인인 개업공인중개사가 부동산 관리대행과 이용·개발·거래 상담 등을 함께 수행할 수 있는 범위를 규정.

## 경쟁 가설 검증

1. [BigValue Finance](https://bigvalue.ai/industry/finance): 부동산 Data & API, 자동 시가추정, 감정평가 업무 자동화 등을 제공한다고 설명.
2. [BigValue AI 디벨로퍼](https://bigvalue.ai/newsroom/H-PR-N-e4b3e69fdbcb479cb07b242ea139e7cb-1745978906997-000000061): 토지·건축물·인구 데이터와 조건 기반 개발 대상지 분석을 설명.
3. [밸류맵 스토어](https://www.valueupmap.com/stores): 법규·규모 검토와 CAD 파일을 포함한 AI 건축설계를 제공.
4. [랜드업](https://home.lan-dup.com/introducecompany/): AI·빅데이터 기반 사업성 검토 자동화와 누적 검토 건수를 소개.

따라서 “AI/GIS가 없는 시장”이라는 표현은 지원되지 않는다. 차별화 가설은 단일 분석 기능이 아니라 다음 폐루프에 둔다.

> 건물주가 보유·매각·임대개선·리모델링/개발 시나리오를 같은 기준으로 비교하고, 선택한 시나리오를 중개·설계·시공·자산관리 실행으로 연결한다.

## MVP 우선순위 점수

이 점수는 관측 시장 데이터가 아니라 2026-07-30 기준 제품 계획용 휴리스틱이다.

각 기능에 대해 아래 세 항목을 1~5점으로 평가하고 합계를 100점으로 환산했다.

- 고객 의사결정 영향
- 현재 데이터 접근성
- 자동화 결과의 검증 안전성

`우선순위 점수 = (영향 + 접근성 + 검증 안전성) / 15 × 100`

| 기능 | 영향 | 접근성 | 검증 안전성 | 점수 | 권장 단계 |
|---|---:|---:|---:|---:|---|
| 주소·필지 식별 | 4 | 5 | 5 | 93 | 1 |
| 건축·토지 팩트 | 5 | 5 | 4 | 93 | 1 |
| 매매 비교사례 | 5 | 3 | 3 | 73 | 1 |
| 보유·매각 시나리오 | 5 | 2 | 3 | 67 | 1 |
| 개발 퀵스크린 | 5 | 3 | 1 | 60 | 2 |
| 3D 자동설계 | 3 | 2 | 1 | 40 | 3 |

점수가 같거나 비슷할 때는 고객 인터뷰에서 더 자주 돈을 지불하는 의사결정을 우선한다.

## 검증 상태

- 공식 API의 제공 항목, 업데이트 주기, 실거래 지번 일부 비공개, VWorld 지오코더 저장 제한은 공식 문서로 확인했다.
- 경쟁사의 기능 존재는 각 회사의 공식 페이지에서 확인했다. 품질, 가격, 고객 유지율은 검증하지 못했다.
- 중소형 빌딩 시장 규모, 유료 지불의사, 보고서→중개/개발 전환율은 현재 근거가 없어 가설로 남긴다.
- MVP 우선순위 점수와 파일럿 성공 기준은 의사결정용 제안이며 시장 관측값이 아니다.
- 개발 가능성은 빠른 선별까지만 자동화하고, 대외 제공 전 건축사·관련 전문가 검토를 필수로 둔다.

