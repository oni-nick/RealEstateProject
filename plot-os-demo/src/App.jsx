import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Buildings,
  CalendarBlank,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Clock,
  FilePdf,
  FloppyDisk,
  Info,
  MapPin,
  MagnifyingGlass,
  ShareNetwork,
  ShieldWarning,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const baseAssumptions = {
  purchasePrice: 60.5,
  ltv: 50,
  interestRate: 4.6,
  vacancy: 12,
  holdYears: 5,
  renovation: 3.2,
  exitCap: 4.5,
};

const scenarioRows = [
  {
    key: "current",
    label: "현재 상태",
    noi: 2.55,
    irrOffset: -1.3,
    saleOffset: -2.2,
    risk: "공실 지속, 임대료 상승 제한",
  },
  {
    key: "lease",
    label: "임대 개선",
    noi: 2.92,
    irrOffset: 0,
    saleOffset: 0,
    risk: "2층 공실 해소 지연",
  },
  {
    key: "renovation",
    label: "리모델링 후 매각",
    noi: 3.24,
    irrOffset: 1.5,
    saleOffset: 6,
    risk: "공사비 초과, 인허가 지연",
  },
];

const cashflowData = [
  { year: "매입", value: -31.5, kind: "out" },
  { year: "1년", value: 1.9, kind: "income" },
  { year: "2년", value: 2.2, kind: "income" },
  { year: "3년", value: 2.4, kind: "income" },
  { year: "4년", value: 2.6, kind: "income" },
  { year: "5년", value: 38.8, kind: "sale" },
];

function formatBillion(value) {
  return `${value.toFixed(1)}억`;
}

function calculateMetrics(a) {
  const priceImpact = (60.5 - a.purchasePrice) * 0.4;
  const leverageImpact = (a.ltv - 50) * 0.035;
  const rateImpact = (4.6 - a.interestRate) * 1.4;
  const vacancyImpact = (12 - a.vacancy) * 0.12;
  const holdImpact = (a.holdYears - 5) * 0.22;
  const renovationImpact = (3.2 - a.renovation) * 0.24;
  const exitImpact = (4.5 - a.exitCap) * 2.1;
  const irr =
    11.6 +
    priceImpact +
    leverageImpact +
    rateImpact +
    vacancyImpact +
    holdImpact +
    renovationImpact +
    exitImpact;
  const equity =
    a.purchasePrice * (1 - a.ltv / 100) +
    a.purchasePrice * 0.046 +
    a.renovation;
  const cashYield = Math.max(
    0.5,
    2.9 +
      (60.5 - a.purchasePrice) * 0.06 +
      (12 - a.vacancy) * 0.05 +
      (4.6 - a.interestRate) * 0.3,
  );
  const maxPrice = a.purchasePrice + (irr - 11) / 0.4;
  const maxVacancy = a.vacancy + Math.max(0, (irr - 9.8) / 0.12);
  const maxRate = a.interestRate + Math.max(0, (irr - 9.8) / 1.4);
  const verdict =
    irr >= 11
      ? {
          status: "조건부 매입 검토",
          detail: `${formatBillion(Math.min(maxPrice, 61.5))} 이하에서 목표 IRR 11%를 충족합니다`,
          tone: "conditional",
        }
      : irr >= 9
        ? {
            status: "보수적 검토",
            detail: "가격 또는 금융 조건 조정 후 재검토가 필요합니다",
            tone: "caution",
          }
        : {
            status: "매입 보류",
            detail: "현재 가정에서는 목표 수익률과 안전마진이 부족합니다",
            tone: "danger",
          };

  return {
    irr,
    equity,
    cashYield,
    maxPrice,
    maxVacancy,
    maxRate,
    verdict,
  };
}

function DemoBadge() {
  return (
    <span className="demo-badge">
      DEMO DATA <span>· 2026.07.30</span>
    </span>
  );
}

function Landing({ onStart }) {
  const [address, setAddress] = useState("서울 강남구 논현동 103-5");
  const [price, setPrice] = useState("64.0");
  const [purpose, setPurpose] = useState("임대 개선 후 보유");
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState(0);

  const startAnalysis = () => {
    setIsLoading(true);
    setSteps(1);
    [2, 3, 4].forEach((step, index) => {
      window.setTimeout(() => setSteps(step), 500 * (index + 1));
    });
    window.setTimeout(onStart, 2250);
  };

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <a className="brand" href="#start" aria-label="PLOT OS 홈">
          PLOT OS
        </a>
        <DemoBadge />
      </header>

      <section className="landing-grid">
        <div className="landing-copy">
          <span className="eyebrow">AI DEAL UNDERWRITING</span>
          <h1>
            이 건물,
            <br />
            얼마에 사야 수익이 날까요?
          </h1>
          <p>
            주소와 매입 조건을 입력하면 가격·임대·리모델링 시나리오를
            비교하고, 투자 결론까지 한 번에 보여드립니다.
          </p>

          <div className="trust-row" aria-label="분석 원칙">
            <span>
              <CheckCircle weight="fill" /> 출처 기반
            </span>
            <span>
              <CheckCircle weight="fill" /> 계산식 공개
            </span>
            <span>
              <CheckCircle weight="fill" /> S 전문가 검토
            </span>
          </div>
        </div>

        <div className="analysis-form-wrap">
          {!isLoading ? (
            <form
              className="analysis-form"
              onSubmit={(event) => {
                event.preventDefault();
                startAnalysis();
              }}
            >
              <div className="form-heading">
                <div>
                  <span className="section-kicker">QUICK CHECK</span>
                  <h2>예시 건물 분석</h2>
                </div>
                <span className="form-time">
                  <Clock /> 약 3초
                </span>
              </div>

              <label>
                건물 주소
                <div className="input-with-icon">
                  <MapPin />
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    aria-label="건물 주소"
                  />
                </div>
              </label>

              <div className="form-row">
                <label>
                  현재 희망가
                  <div className="price-input">
                    <input
                      value={price}
                      inputMode="decimal"
                      onChange={(event) => setPrice(event.target.value)}
                      aria-label="현재 희망가"
                    />
                    <span>억 원</span>
                  </div>
                </label>
                <label>
                  검토 목적
                  <select
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                  >
                    <option>임대 개선 후 보유</option>
                    <option>리모델링 후 매각</option>
                    <option>사옥 매입</option>
                  </select>
                </label>
              </div>

              <button className="primary-button large" type="submit">
                <MagnifyingGlass weight="bold" />
                데모 분석 시작
              </button>
              <p className="form-note">
                실제 매물 또는 투자 권유가 아닌 제품 검증용 예시입니다.
              </p>
            </form>
          ) : (
            <div className="analysis-loading" aria-live="polite">
              <span className="loading-orbit">
                <Buildings weight="duotone" />
              </span>
              <span className="section-kicker">ANALYZING</span>
              <h2>투자 판단 근거를 모으고 있습니다</h2>
              <div className="loading-steps">
                {[
                  "주소·필지 확인",
                  "건축물 정보 조회",
                  "주변 거래 비교",
                  "시나리오 계산",
                ].map((label, index) => (
                  <div
                    className={steps > index ? "done" : ""}
                    key={label}
                  >
                    <span>{steps > index ? "✓" : index + 1}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="landing-asset">
        <img
          src="./assets/nonhyeon-demo-building.png"
          alt="익명화한 논현동 데모 상업용 건물"
        />
        <div>
          <span className="section-kicker">SELECTED DEMO ASSET</span>
          <h3>논현동 103-5 · 근린생활시설</h3>
          <p>
            1990년 준공 · 대지 191.9㎡ · 연면적 474.2㎡ · 리모델링과 임대
            개선 가능성을 함께 검토할 수 있는 사례
          </p>
        </div>
      </section>
    </main>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  icon: Icon,
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <label className="assumption-control">
      <span className="control-label">
        <span>
          <Icon />
          {label}
          <Info weight="fill" title={`${label} 데모 가정`} />
        </span>
        <span className="provenance-chip">사용자 수정</span>
      </span>
      <div className="range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ "--range-value": `${percent}%` }}
          aria-label={label}
        />
        <span className="number-field">
          {Number(value).toFixed(step < 1 ? 1 : 0)}
          <small>{suffix}</small>
        </span>
      </div>
    </label>
  );
}

function Report({ onBack }) {
  const [assumptions, setAssumptions] = useState(baseAssumptions);
  const [saved, setSaved] = useState(false);
  const [consultation, setConsultation] = useState(false);
  const metrics = useMemo(
    () => calculateMetrics(assumptions),
    [assumptions],
  );

  const update = (key, value) => {
    setSaved(false);
    setAssumptions((current) => ({ ...current, [key]: value }));
  };

  const scenarios = useMemo(
    () =>
      scenarioRows.map((row) => ({
        ...row,
        irr: metrics.irr + row.irrOffset,
        equity: metrics.equity + (row.key === "renovation" ? 3.2 : 0),
        sale: 69.8 + row.saleOffset + (60.5 - assumptions.purchasePrice),
      })),
    [assumptions.purchasePrice, metrics.equity, metrics.irr],
  );

  const shareReport = async () => {
    const url = `${window.location.origin}${window.location.pathname}#report`;
    try {
      await navigator.clipboard.writeText(url);
      setSaved("링크 복사됨");
    } catch {
      setSaved("공유 준비됨");
    }
  };

  return (
    <main className="app-shell" id="report">
      <header className="app-header">
        <div className="header-left">
          <button
            className="icon-button back-button"
            onClick={onBack}
            aria-label="처음으로"
          >
            <ArrowLeft />
          </button>
          <a className="brand" href="#start" onClick={onBack}>
            PLOT OS
          </a>
        </div>
        <div className="asset-title">
          <strong>논현동 103-5 데모 자산</strong>
          <DemoBadge />
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={shareReport}>
            <ShareNetwork />
            {typeof saved === "string" ? saved : "공유"}
          </button>
          <button
            className="secondary-button hide-mobile"
            onClick={() => window.print()}
          >
            <FilePdf />
            PDF 미리보기
          </button>
          <button
            className="primary-button"
            onClick={() => setConsultation(true)}
          >
            <span className="initial-mark">S</span>
            전문가 검토 요청
          </button>
        </div>
      </header>

      <section className="asset-context">
        <img
          src="./assets/nonhyeon-demo-building.png"
          alt="익명화한 논현동 데모 상업용 건물"
        />
        <div className="asset-facts">
          <span>
            <MapPin /> 서울 강남구 논현동
          </span>
          <span>근린생활시설</span>
          <span>대지 191.9㎡</span>
          <span>연면적 474.2㎡</span>
          <span>1990년 준공</span>
          <span>
            <CalendarBlank /> 분석일 2026.07.30
          </span>
        </div>
      </section>

      <div className="report-layout">
        <section className="analysis-column">
          <div className={`verdict-section ${metrics.verdict.tone}`}>
            <div className="verdict-copy">
              <span className="status-label">조건부 검토</span>
              <h1>{metrics.verdict.status}</h1>
              <p>{metrics.verdict.detail}</p>
              <span className="confidence">
                신뢰도 <strong>중간</strong> · 확인 필요 3건
              </span>
            </div>
            <div className="conditions">
              <span className="section-kicker">충족 필요 조건</span>
              <ol>
                <li>
                  <span>1</span>61.5억 이하 협상
                </li>
                <li>
                  <span>2</span>2층 공실 해소
                </li>
                <li>
                  <span>3</span>불법 증축 여부 확인
                </li>
              </ol>
            </div>
          </div>

          <div className="kpi-row" aria-label="핵심 투자 지표">
            <div>
              <span>분석 매입가</span>
              <strong>{formatBillion(assumptions.purchasePrice)}</strong>
            </div>
            <div>
              <span>필요 자기자본</span>
              <strong>{formatBillion(metrics.equity)}</strong>
            </div>
            <div>
              <span>5년 IRR</span>
              <strong className={metrics.irr >= 11 ? "positive" : "warning"}>
                {metrics.irr.toFixed(1)}%
              </strong>
            </div>
            <div>
              <span>현금수익률</span>
              <strong className="positive">{metrics.cashYield.toFixed(1)}%</strong>
            </div>
          </div>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="section-kicker">DECISION MODEL</span>
                <h2>시나리오 비교</h2>
              </div>
              <span className="section-meta">
                현재 가정 기준 · 단위 억 원
              </span>
            </div>

            <div className="scenario-table-wrap">
              <table className="scenario-table">
                <thead>
                  <tr>
                    <th>시나리오</th>
                    <th>자기자본</th>
                    <th>NOI</th>
                    <th>IRR</th>
                    <th>예상 매각가</th>
                    <th>주요 위험</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((scenario) => (
                    <tr
                      className={scenario.key === "lease" ? "selected" : ""}
                      key={scenario.key}
                    >
                      <th>
                        {scenario.label}
                        {scenario.key === "lease" && (
                          <span className="recommended-chip">기본</span>
                        )}
                      </th>
                      <td>{formatBillion(scenario.equity)}</td>
                      <td>{scenario.noi.toFixed(2)}억</td>
                      <td className={scenario.irr >= 11 ? "positive" : ""}>
                        {scenario.irr.toFixed(1)}%
                      </td>
                      <td>{formatBillion(scenario.sale)}</td>
                      <td>{scenario.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="chart-section">
            <div className="chart-card">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">BASE SCENARIO</span>
                  <h2>5년간 현금흐름</h2>
                </div>
                <span className="section-meta">단위 억 원</span>
              </div>
              <div className="chart-wrap" aria-label="5년 현금흐름 차트">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={cashflowData}>
                    <CartesianGrid
                      stroke="#e4e5de"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="year"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#68716d", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#68716d", fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(22, 77, 64, 0.05)" }}
                      formatter={(value) => [`${value}억 원`, "현금흐름"]}
                    />
                    <Bar
                      dataKey="value"
                      fill="#174e42"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="insight-card">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">SENSITIVITY</span>
                  <h2>민감도 인사이트</h2>
                </div>
              </div>
              <div className="insight-list">
                <div>
                  <span className="impact-icon positive">↓</span>
                  <p>
                    매입가 1억 하락
                    <strong className="positive">IRR +0.4%p</strong>
                  </p>
                </div>
                <div>
                  <span className="impact-icon danger">↑</span>
                  <p>
                    금리 0.5%p 상승
                    <strong className="danger">IRR -0.7%p</strong>
                  </p>
                </div>
                <div>
                  <span className="impact-icon positive">↓</span>
                  <p>
                    공실률 5%p 개선
                    <strong className="positive">IRR +0.6%p</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="assumption-studio">
          <div className="studio-heading">
            <div>
              <span className="section-kicker">LIVE UNDERWRITING</span>
              <h2>Assumption Studio</h2>
              <p>가정을 바꾸면 결론이 바로 갱신됩니다.</p>
            </div>
            <SlidersHorizontal size={24} />
          </div>

          <RangeControl
            label="매입가"
            value={assumptions.purchasePrice}
            min={52}
            max={70}
            step={0.5}
            suffix="억"
            icon={Buildings}
            onChange={(value) => update("purchasePrice", value)}
          />

          <div className="segmented-control-block">
            <span className="control-label">
              <span>
                <ChartLineUp />
                대출비율 (LTV)
                <Info weight="fill" title="매입가격 대비 대출 비율" />
              </span>
              <span className="provenance-chip">기준</span>
            </span>
            <div className="segmented-control">
              {[40, 50, 60].map((value) => (
                <button
                  className={assumptions.ltv === value ? "active" : ""}
                  onClick={() => update("ltv", value)}
                  key={value}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          <RangeControl
            label="금리"
            value={assumptions.interestRate}
            min={3}
            max={7}
            step={0.1}
            suffix="%"
            icon={ChartLineUp}
            onChange={(value) => update("interestRate", value)}
          />
          <RangeControl
            label="공실률"
            value={assumptions.vacancy}
            min={0}
            max={30}
            step={1}
            suffix="%"
            icon={Buildings}
            onChange={(value) => update("vacancy", value)}
          />

          <div className="segmented-control-block">
            <span className="control-label">
              <span>
                <CalendarBlank />
                보유기간
                <Info weight="fill" title="매입 후 예상 보유기간" />
              </span>
              <span className="provenance-chip">사용자 수정</span>
            </span>
            <div className="segmented-control">
              {[3, 5, 7].map((value) => (
                <button
                  className={assumptions.holdYears === value ? "active" : ""}
                  onClick={() => update("holdYears", value)}
                  key={value}
                >
                  {value}년
                </button>
              ))}
            </div>
          </div>

          <RangeControl
            label="리모델링 비용"
            value={assumptions.renovation}
            min={0}
            max={10}
            step={0.1}
            suffix="억"
            icon={Buildings}
            onChange={(value) => update("renovation", value)}
          />
          <RangeControl
            label="Exit cap rate"
            value={assumptions.exitCap}
            min={3}
            max={6}
            step={0.1}
            suffix="%"
            icon={ChartLineUp}
            onChange={(value) => update("exitCap", value)}
          />

          <div className="live-results">
            <div>
              <span>IRR ({assumptions.holdYears}년)</span>
              <strong>{metrics.irr.toFixed(1)}%</strong>
              <small className={metrics.irr >= 11 ? "positive" : "danger"}>
                {metrics.irr >= 11 ? "목표 충족" : "목표 미달"}
              </small>
            </div>
            <div>
              <span>필요 자기자본</span>
              <strong>{formatBillion(metrics.equity)}</strong>
              <small>취득비·공사비 포함</small>
            </div>
          </div>

          <div className="break-even">
            <h3>손익분기 조건</h3>
            <div>
              <span>
                최대 매입가
                <strong>{formatBillion(Math.min(metrics.maxPrice, 67))}</strong>
              </span>
              <span>
                최대 공실률
                <strong>{Math.min(metrics.maxVacancy, 30).toFixed(0)}%</strong>
              </span>
              <span>
                최대 금리
                <strong>{Math.min(metrics.maxRate, 7).toFixed(1)}%</strong>
              </span>
            </div>
          </div>

          <div className="studio-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setAssumptions(baseAssumptions);
                setSaved(false);
              }}
            >
              기본값 복원
            </button>
            <button
              className="primary-button"
              onClick={() => setSaved(true)}
            >
              <FloppyDisk />
              {saved === true ? "저장 완료" : "이 조건 저장"}
            </button>
          </div>
        </aside>
      </div>

      <section className="risk-strip">
        <h2>
          <ShieldWarning weight="duotone" />
          핵심 리스크 3건
        </h2>
        <div>
          <span>
            <strong>불법 증축 여부</strong>
            <small className="risk-chip danger">현장 확인 필요</small>
          </span>
          <span>
            <strong>2층 임대차</strong>
            <small className="risk-chip danger">계약서 확인 필요</small>
          </span>
          <span>
            <strong>리모델링 견적</strong>
            <small className="risk-chip caution">추정치</small>
          </span>
        </div>
        <button className="text-button">
          실사 체크리스트 보기
          <CaretRight />
        </button>
      </section>

      {consultation && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setConsultation(false)}
        >
          <div
            className="consultation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consultation-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="initial-mark large">S</span>
            <span className="section-kicker">EXPERT REVIEW</span>
            <h2 id="consultation-title">전문가 검토 요청이 준비되었습니다</h2>
            <p>
              현재 가정과 시나리오를 기준으로 현장·임대차·가격 검토를
              요청합니다. 데모에서는 실제 정보가 전송되지 않습니다.
            </p>
            <div className="modal-summary">
              <span>
                분석 매입가 <strong>{formatBillion(assumptions.purchasePrice)}</strong>
              </span>
              <span>
                예상 IRR <strong>{metrics.irr.toFixed(1)}%</strong>
              </span>
            </div>
            <button
              className="primary-button large"
              onClick={() => setConsultation(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export function App() {
  const [screen, setScreen] = useState(
    window.location.hash === "#report" ? "report" : "start",
  );

  const showReport = () => {
    window.location.hash = "report";
    setScreen("report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showLanding = () => {
    window.location.hash = "start";
    setScreen("start");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return screen === "report" ? (
    <Report onBack={showLanding} />
  ) : (
    <Landing onStart={showReport} />
  );
}
