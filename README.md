# PLOT OS

> 서울 중소형 빌딩의 매입가격·임대·리모델링 시나리오를 비교하고, 전문가 검토와 실제 실행으로 연결하는 AI Deal Underwriting 서비스

[![Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-174e42?style=for-the-badge)](https://oni-nick.github.io/RealEstateProject/)
[![React](https://img.shields.io/badge/React-19-18242b?style=flat-square&logo=react)](./plot-os-demo)
[![Status](https://img.shields.io/badge/Status-Interactive_Demo-c58a2a?style=flat-square)](./idea_scaffolding)

## 데모에서 확인할 수 있는 것

- 주소와 매입 조건을 입력하는 Quick Check 흐름
- 서울 강남구 논현동 103-5 참조 건물의 투자 결론
- 현재 상태·임대 개선·리모델링 후 매각 시나리오 비교
- 매입가·LTV·금리·공실률·보유기간·공사비 조정
- 가정 변경에 따른 IRR·자기자본·손익분기 조건 갱신
- 핵심 위험과 S 전문가 검토 요청

## 핵심 화면

```text
주소와 매입 조건 입력
        ↓
데이터 수집·분석
        ↓
조건부 매입 검토
        ↓
시나리오와 가정 조정
        ↓
위험 확인·전문가 검토 요청
```

데모는 공개 매매사례로 소개된 `서울 강남구 논현동 103-5` 건물을 참고 자산으로 사용한다. 주소와 공개된 자산 규모를 제외한 임대차·금융·리모델링 수치는 모두 제품 시연용 가정이다.

## 프로젝트 구조

| 경로 | 내용 |
|---|---|
| [`plot-os-demo`](./plot-os-demo) | React 기반 인터랙티브 웹 데모 |
| [`idea_scaffolding`](./idea_scaffolding) | 역할, 첫 상품, 웹 데모, 자산 선정 문서 |
| [`idea_by_song`](./idea_by_song) | 초기 사업 아이디어 원문 |

## 로컬 실행

```bash
cd plot-os-demo
npm install
npm run dev
```

프로덕션 빌드는 다음 명령으로 확인한다.

```bash
npm run build
npm run test:sites
```

## 데모 기술 구성

- React 19 + Vite
- Recharts
- Phosphor Icons
- GitHub Actions + GitHub Pages
- 백엔드와 API 키가 필요 없는 정적 예시 데이터

## 창업팀

| 역할 | 책임 |
|---|---|
| S · Deal & Execution | 고객, 현장, 중개, 협상, 전문가·시공 네트워크 |
| K · Product & Intelligence | 데이터, 계산 엔진, AI·에이전트, 제품 개발 |

## 유의사항

이 저장소의 분석 결과는 제품 검증을 위한 데모이며 감정평가, 법률·세무 판단 또는 투자 권유가 아니다. 실제 거래에서는 공인중개사와 관련 자격 전문가의 확인이 필요하다.

---

사업 및 제품 정의는 [아이디어 구체화 문서](./idea_scaffolding/README.md)에서 확인할 수 있다.
