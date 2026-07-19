// Policies are populated only by the reviewed production policy API.
let benefits = [];

const categoryBenefits = {
  housing: {
    title: "주거 지원 비교",
    lead: "월세와 거주 지역을 기준으로 먼저 확인할 주거 지원 제도를 정리했어요.",
  },
  education: {
    title: "교육·취업 지원 비교",
    lead: "교육비를 줄일지, 취업 준비 비용을 줄일지에 따라 먼저 확인할 제도가 달라져요.",
  },
  saving: {
    title: "자산형성 비교",
    lead: "당장 받을 혜택보다, 매달 얼마를 얼마나 오래 낼 수 있는지부터 비교해요.",
  },
};

let activeCategory = null;
let activeCategoryPolicies = [];
let policyDataStatus = "loading";

const state = {
  profile: JSON.parse(localStorage.getItem("bridge-profile") || "null"),
  saved: JSON.parse(localStorage.getItem("bridge-saved") || "[]"),
  logs: JSON.parse(localStorage.getItem("bridge-logs") || "[]"),
  comparedAt: JSON.parse(localStorage.getItem("bridge-compared-at") || "null"),
};

const anonymousUserId = localStorage.getItem("bridge-anonymous-user-id") || `anon_${crypto.randomUUID()}`;
localStorage.setItem("bridge-anonymous-user-id", anonymousUserId);
const sessionId = sessionStorage.getItem("bridge-session-id") || `session_${crypto.randomUUID()}`;
sessionStorage.setItem("bridge-session-id", sessionId);
const flowState = {
  comparisonId: sessionStorage.getItem("bridge-comparison-id") || null,
};
const serverLogState = { connected: false, loaded: false, storage: null };

let detailReading = null;
let detailSectionObserver = null;
let transportForm = null;
let toastTimer = null;
const viewHistory = [];

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function addSectionTime(section) {
  if (!detailReading || !detailReading.sectionStarts[section]) return;
  const elapsed = Date.now() - detailReading.sectionStarts[section];
  detailReading.sectionDurations[section] = (detailReading.sectionDurations[section] || 0) + elapsed;
  delete detailReading.sectionStarts[section];
}

function pauseDetailReading() {
  if (!detailReading || !detailReading.isActive) return;
  detailReading.activeMs += Date.now() - detailReading.activeStartedAt;
  Object.keys(detailReading.sectionStarts).forEach(addSectionTime);
  detailReading.isActive = false;
}

function resumeDetailReading() {
  if (!detailReading || detailReading.isActive || document.visibilityState === "hidden") return;
  detailReading.isActive = true;
  detailReading.activeStartedAt = Date.now();
}

function startDetailReading(benefitId) {
  finishDetailReading("detail_replaced");
  detailReading = {
    benefitId,
    openedAt: Date.now(),
    activeStartedAt: Date.now(),
    activeMs: 0,
    isActive: document.visibilityState !== "hidden",
    sectionStarts: {},
    sectionDurations: {},
    seenSections: new Set(),
    scrollDepths: new Set(),
  };

  if ("IntersectionObserver" in window) {
    detailSectionObserver = new IntersectionObserver(
      (entries) => {
        if (!detailReading) return;
        entries.forEach((entry) => {
          const section = entry.target.dataset.readingSection;
          if (entry.isIntersecting) {
            detailReading.seenSections.add(section);
            if (detailReading.isActive && !detailReading.sectionStarts[section]) {
              detailReading.sectionStarts[section] = Date.now();
            }
          } else {
            addSectionTime(section);
          }
        });
      },
      { threshold: 0.55 }
    );
    document.querySelectorAll("[data-reading-section]").forEach((section) => detailSectionObserver.observe(section));
  }
}

function finishDetailReading(exitAction) {
  if (!detailReading) return;
  pauseDetailReading();
  if (detailSectionObserver) {
    detailSectionObserver.disconnect();
    detailSectionObserver = null;
  }

  Object.entries(detailReading.sectionDurations).forEach(([section, durationMs]) => {
    track("detail_section_dwell", detailReading.benefitId, "detail", {
      section,
      durationSeconds: Math.round(durationMs / 1000),
    });
  });
  track("detail_exit", detailReading.benefitId, "detail", {
    exitAction,
    durationSeconds: Math.round(detailReading.activeMs / 1000),
    seenSections: [...detailReading.seenSections],
    scrollDepths: [...detailReading.scrollDepths].sort((a, b) => a - b),
  });
  detailReading = null;
}

function updateDetailScrollDepth() {
  if (!detailReading || !detailReading.isActive) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return;
  const scrollPercent = Math.round((window.scrollY / maxScroll) * 100);
  const depth = [25, 50, 75, 100].find((value) => scrollPercent >= value && !detailReading.scrollDepths.has(value));
  if (!depth) return;
  detailReading.scrollDepths.add(depth);
  track("detail_scroll_depth", detailReading.benefitId, "detail", { depth });
}

function track(eventType, benefitId = null, step = "general", metadata = {}) {
  const event = {
    eventId: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    anonymousUserId,
    benefitId,
    eventType,
    step,
    metadata: {
      sessionId,
      comparisonId: flowState.comparisonId,
      ...metadata,
    },
    createdAt: new Date().toISOString(),
  };
  state.logs.push(event);
  localStorage.setItem("bridge-logs", JSON.stringify(state.logs));
  saveEventToServer(event);
  renderLogs();
}

async function saveEventToServer(event) {
  if (window.location.protocol === "file:") return;
  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    serverLogState.connected = response.ok;
  } catch {
    serverLogState.connected = false;
  }
}

async function syncEventsWithServer() {
  if (window.location.protocol === "file:") return;
  try {
    for (const event of state.logs) await saveEventToServer(event);
    const response = await fetch(`/api/events?anonymousUserId=${encodeURIComponent(anonymousUserId)}`);
    if (!response.ok) throw new Error("Unable to load events");
    const { events, storage } = await response.json();
    state.logs = events;
    localStorage.setItem("bridge-logs", JSON.stringify(state.logs));
    serverLogState.connected = true;
    serverLogState.storage = storage;
    serverLogState.loaded = true;
    renderLogs();
  } catch {
    serverLogState.connected = false;
  }
}

async function loadPolicies() {
  try {
    const response = await fetch("/api/policies?category=transport");
    if (!response.ok) throw new Error("Policy database is unavailable");
    const { policies } = await response.json();
    benefits = policies;
    policyDataStatus = "ready";
  } catch {
    benefits = [];
    policyDataStatus = "unavailable";
  }
  if (document.getElementById("home").classList.contains("active")) renderHome();
}

function show(view, detailExitAction = "navigation", options = {}) {
  const currentView = document.querySelector(".view.active")?.id;
  if (currentView && currentView !== view && !options.fromBack) viewHistory.push(currentView);
  if (view !== "detail" && detailReading) finishDetailReading(detailExitAction);
  if (currentView === "transport" && view !== "transport") finishTransportForm(view);
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById(view).classList.add("active");
  if (view === "transport" && currentView !== "transport") startTransportForm();
  if (view === "home") renderHome();
  if (view === "saved") renderSaved();
  if (view === "logs") renderLogs();
}

function goBackFromDetail() {
  track("detail_back_click", detailReading?.benefitId || null, "detail");
  goBack("home");
}

function goBack(fallbackView = "categories") {
  const previousView = viewHistory.pop() || fallbackView;
  show(previousView, "back_button", { fromBack: true });
}

function selectCategory(category) {
  track("category_select", null, "category", { category });
  if (category === "transport") {
    show("transport");
    return;
  }
  activeCategory = category;
  show("categoryCompare");
  renderCategoryComparison();
}

async function renderCategoryComparison() {
  const category = categoryBenefits[activeCategory];
  if (!category) return;
  const profile = state.profile;
  document.getElementById("categoryCompareTitle").textContent = category.title;
  document.getElementById("categoryCompareLead").textContent = profile
    ? `${profile.region} · ${profile.status} 기준으로 ${category.lead}`
    : `${category.lead} 내 정보를 저장하면 지역과 상태를 함께 반영할 수 있어요.`;
  const list = document.getElementById("categoryBenefitList");
  list.innerHTML = `<div class="empty-state"><p>검증된 공식 정책을 불러오는 중이에요.</p></div>`;
  try {
    const response = await fetch(`/api/policies?category=${encodeURIComponent(activeCategory)}`);
    if (!response.ok) throw new Error("Policy database is unavailable");
    const { policies } = await response.json();
    activeCategoryPolicies = policies;
  } catch {
    activeCategoryPolicies = [];
  }
  if (activeCategory !== Object.keys(categoryBenefits).find((key) => categoryBenefits[key] === category)) return;
  if (!activeCategoryPolicies.length) {
    list.innerHTML = `<div class="empty-state"><p>현재 공식 확인 필요. 출처·기준일·갱신일 검토가 완료된 active 정책만 표시하며, 오래되었거나 검토 중인 정책은 추천하지 않습니다.</p></div>`;
    return;
  }
  list.innerHTML = activeCategoryPolicies
    .map(
      (benefit, index) => `
        <article class="card">
          <span class="badge">${index === 0 ? "먼저 확인" : "함께 비교"}</span>
          <h3>${benefit.title}</h3>
          <p>${benefit.summary}</p>
          <p class="muted"><b>확인할 조건</b>: ${benefit.caution}</p>
          <p class="muted">${sourceMetaLine(benefit)}</p>
          <p class="muted">${applicationPeriodLine(benefit)}</p>
          <div class="actions">
            <button data-action="category-link" data-benefit-id="${benefit.id}">${getOfficialLinkLabel(benefit)}</button>
          </div>
        </article>`
    )
    .join("");
  track("category_results_viewed", null, "category", { category: activeCategory, resultCount: activeCategoryPolicies.length });
}

function openCategoryBenefit(id) {
  const benefit = activeCategoryPolicies.find((item) => item.id === id);
  if (!benefit) return;
  const targetUrl = benefit.applicationUrl || benefit.sourceUrl;
  track("category_official_link_click", id, "apply", { category: activeCategory, sourceUrl: targetUrl });
  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
function syncCostInputState() {
  const costRange = document.getElementById("costRange").value;
  const monthlyCostInput = document.getElementById("monthlyTransitCost");
  const usesDirectInput = costRange === "direct";
  monthlyCostInput.disabled = !usesDirectInput;
  if (!usesDirectInput) monthlyCostInput.value = "";
}

function syncConditionalInputs() {
  const area = document.getElementById("mobilityArea").value;
  const isCapitalArea = area === "서울 안" || area === "수도권 이동";
  const isSeoulOnly = area === "서울 안";
  const isLongDistance = area === "지역 간 이동";
  document.getElementById("plusTransitField").hidden = !isCapitalArea;
  document.getElementById("bikeField").hidden = !isSeoulOnly;
  document.getElementById("railField").hidden = !isLongDistance;
  if (!isCapitalArea) document.getElementById("usesPlusTransit").value = "no";
  if (!isSeoulOnly) document.getElementById("bikeUsage").value = "no";
  if (!isLongDistance) document.getElementById("longDistanceUse").value = "no";
}

function getAnalyticsProfile(profile) {
  const age = Number(profile.age || 0);
  const transitCost = Number(profile.monthlyTransitCost || 0);
  return {
    ageGroup: age <= 22 ? "19~22세" : age <= 27 ? "23~27세" : "28세 이상",
    region: profile.region,
    status: profile.status,
    transitCostRange: transitCost <= 30000 ? "3만원 이하" : transitCost <= 60000 ? "3~6만원" : transitCost <= 90000 ? "6~9만원" : "9만원 초과",
    mobilityArea: profile.mobilityArea,
    monthly15Rides: profile.monthly15Rides,
    usesPlusTransit: profile.usesPlusTransit,
    bikeUsage: profile.bikeUsage,
    longDistanceUse: profile.longDistanceUse,
    incomeAnswered: Boolean(profile.income && profile.income !== "잘 모르겠어요"),
    housingAnswered: Boolean(profile.housing && profile.housing !== "잘 모르겠어요"),
  };
}

function startTransportForm() {
  if (transportForm) return;
  flowState.comparisonId = null;
  sessionStorage.removeItem("bridge-comparison-id");
  transportForm = {
    formId: `form_${crypto.randomUUID()}`,
    openedAt: Date.now(),
    completed: false,
  };
  track("transport_form_view", null, "input", { formId: transportForm.formId });
}

function finishTransportForm(nextView) {
  if (!transportForm) return;
  track("transport_form_exit", null, "input", {
    formId: transportForm.formId,
    completed: transportForm.completed,
    nextView,
    durationSeconds: Math.round((Date.now() - transportForm.openedAt) / 1000),
  });
  transportForm = null;
}

function saveProfile() {
  const previous = state.profile || {};
  const age = Number(document.getElementById("age").value || 0);
  const region = document.getElementById("region").value.trim();
  const district = document.getElementById("district").value;
  if (age < 13 || age > 99 || !region) {
    showToast("나이와 지역을 올바르게 입력해 주세요.");
    return;
  }
  state.profile = {
    ...previous,
    age,
    region,
    district,
    status: document.getElementById("status").value,
    income: document.getElementById("income").value,
    housing: document.getElementById("housing").value,
  };
  localStorage.setItem("bridge-profile", JSON.stringify(state.profile));
  track("profile_save", null, "profile", getAnalyticsProfile(state.profile));
  showToast("내 정보가 저장됐어요.");
}

function hasSavedProfile() {
  const age = Number(state.profile?.age || 0);
  return age >= 13 && age <= 99 && Boolean(state.profile?.region);
}

function compareTransport() {
  const costRange = document.getElementById("costRange").value;
  const directCost = Number(document.getElementById("monthlyTransitCost").value || 0);
  const mobilityArea = document.getElementById("mobilityArea").value;
  const monthly15Rides = document.getElementById("monthly15Rides").value;
  const usesPlusTransit = document.getElementById("usesPlusTransit").value;
  const bikeUsage = document.getElementById("bikeUsage").value;
  const longDistanceUse = document.getElementById("longDistanceUse").value;
  const monthlyRideCount = monthly15Rides === "yes" ? 30 : monthly15Rides === "no" ? 10 : 0;
  const transportModes = ["subway", "city-bus"];
  if (usesPlusTransit === "yes") transportModes.push("metro-bus", "gtx");
  if (bikeUsage !== "no") transportModes.push("ddareungi");
  if (longDistanceUse === "yes") transportModes.push("ktx");
  const monthlyBikeCost = bikeUsage === "pass" ? 5000 : 0;
  const longDistanceTrips = longDistanceUse === "yes" ? 1 : 0;
  const previous = state.profile || {};

  if (!hasSavedProfile()) {
    showToast("먼저 내 정보에서 나이와 지역을 저장해 주세요.");
    show("profile");
    return;
  }
  if (costRange === "direct" && !directCost) {
    showToast("월 버스·지하철 교통비를 입력하거나 범위를 선택해 주세요.");
    return;
  }

  state.profile = {
    age: previous.age,
    region: previous.region,
    district: previous.district || "",
    status: previous.status || "재학 중",
    income: previous.income || "잘 모르겠어요",
    housing: previous.housing || "잘 모르겠어요",
    monthlyTransitCost: costRange === "direct" ? directCost : Number(costRange),
    costRange,
    mobilityArea,
    monthly15Rides,
    usesPlusTransit,
    bikeUsage,
    longDistanceUse,
    longDistanceTrips,
    monthlyBikeCost,
    transportModes,
    monthlyRideCount,
  };
  state.comparedAt = Date.now();
  flowState.comparisonId = `cmp_${crypto.randomUUID()}`;
  sessionStorage.setItem("bridge-comparison-id", flowState.comparisonId);
  if (transportForm) transportForm.completed = true;
  localStorage.setItem("bridge-profile", JSON.stringify(state.profile));
  localStorage.setItem("bridge-compared-at", JSON.stringify(state.comparedAt));
  track("compare_submit", null, "input", {
    ...getAnalyticsProfile(state.profile),
    formId: transportForm?.formId || null,
  });
  show("home");
}

function getRoadmap(age, status = "") {
  if (status.includes("재직")) {
    return "재직 초기라면 교통비 다음으로 월세 지원과 자산형성 혜택을 비교해보면 좋아요.";
  }
  if (status.includes("구직") || status.includes("취업 준비")) {
    return "구직 단계라면 교통비와 면접비 지원을 먼저 비교해보면 좋아요.";
  }
  if (age <= 22) return "20~22세는 이동이 많을 수 있어 교통비 혜택 비교부터 시작하기 좋아요.";
  if (age <= 27) return "23~27세는 교통비와 주거 지원을 함께 비교할 시기예요.";
  return "28세 이후는 교통비보다 주거, 청약, 자산형성 혜택 비교가 더 중요해질 수 있어요.";
}

function estimateMonthlyRideCount(frequency) {
  const counts = {
    daily: 44,
    often: 30,
    sometimes: 14,
    rarely: 6,
  };
  return counts[frequency] || 14;
}

function getFrequencyLabel(frequency) {
  return {
    daily: "거의 매일",
    often: "주 3~4일",
    sometimes: "주 1~2일",
    rarely: "가끔",
  }[frequency] || "주 1~2일";
}

function formatWon(value) {
  return `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;
}

function getBenefitValueLabel(benefit) {
  if (benefit.type === "long-distance") return `운임의 ${benefit.discountRange} 할인 가능성`;
  return `${formatWon(benefit.estimatedSaving)} 예상 이득`;
}

function formatPolicyDate(value) {
  if (!value) return "공식 확인 필요";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "공식 확인 필요";
  return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

function getOfficialLinkLabel(benefit) {
  return benefit.applicationUrl ? "공식 신청/가입" : "공식 안내 보기";
}

function sourceMetaLine(benefit) {
  return `공식 출처: ${benefit.sourceName || benefit.provider} · 기준일 ${formatPolicyDate(benefit.sourcePublishedAt)} · 갱신일 ${formatPolicyDate(benefit.sourceUpdatedAt)}`;
}

function applicationPeriodLine(benefit) {
  const period = benefit.applicationPeriod || {};
  if (!period.kind) return "접수 기간: 현재 공식 확인 필요";
  const fallback = period.kind === "ongoing" ? "상시" : period.kind === "scheduled" ? "기간 확인 필요" : "접수 종료";
  return `접수 기간: ${period.label || fallback}`;
}
function calculateBenefit(benefit) {
  const profile = state.profile || {
    age: 22,
    region: "서울",
    monthlyTransitCost: 75000,
    mobilityArea: "서울 안",
    mobilityFrequency: "daily",
    longDistanceTrips: 0,
    transportModes: ["subway", "city-bus"],
  };
  const monthlyCost = Number(profile.monthlyTransitCost || 0);
  const monthlyBikeCost = Number(profile.monthlyBikeCost || 0);
  const rides = Number(profile.monthlyRideCount || 0);
  const modes = profile.transportModes || ["subway", "city-bus"];
  const area = profile.mobilityArea || "서울 안";
  const longDistanceTrips = Number(profile.longDistanceTrips || 0);
  const ageOk = profile.age >= benefit.minAge && profile.age <= benefit.maxAge;
  const regionOk = benefit.region === "전국" || benefit.region === profile.region;
  const requiredDistrict = typeof benefit.requiredDistrict === "string" ? benefit.requiredDistrict : "";
  const districtOk = !requiredDistrict || profile.district === requiredDistrict;
  const usesDailyTransit = modes.some((mode) => ["subway", "city-bus", "metro-bus", "gtx"].includes(mode));
  const usesLongDistance = modes.some((mode) => ["ktx", "intercity"].includes(mode)) || longDistanceTrips > 0 || area === "지역 간 이동";
  const usesDdareungi = modes.includes("ddareungi");
  const usesPlusTransit = modes.some((mode) => ["metro-bus", "gtx"].includes(mode));
  const meetsRideMinimum = rides >= (benefit.minMonthlyRides || 0);
  const replacedByRegionalPass = benefit.id === "k-pass" && profile.region === "경기";

  let estimatedSaving = 0;
  let formula = "";

  if (benefit.type === "refund") {
    estimatedSaving = usesDailyTransit && meetsRideMinimum && !replacedByRegionalPass ? monthlyCost * benefit.refundRate : 0;
    if (benefit.maxMonthlyBenefit) estimatedSaving = Math.min(estimatedSaving, benefit.maxMonthlyBenefit);
    const refundPercent = Math.round((benefit.refundRate || 0) * 100);
    formula = replacedByRegionalPass
      ? "경기도 거주자는 지역형 K-패스 적용 여부를 공식 기관에서 확인 필요"
      : meetsRideMinimum
        ? `월 ${rides}회 이용 기준, 교통비 ${formatWon(monthlyCost)}의 약 ${refundPercent}% 환급 예상`
        : `월 ${benefit.minMonthlyRides}회 이상 이용해야 환급 가능`;
  }

  if (benefit.type === "fixed-pass") {
    const areaOk = area === "서울 안" && !modes.includes("metro-bus") && !usesLongDistance;
    const passCost = benefit.passCost + (usesDdareungi ? benefit.ddareungiAddOn : 0);
    estimatedSaving = areaOk ? Math.max(0, monthlyCost + monthlyBikeCost - passCost) : 0;
    formula = areaOk
      ? `서울 안 이동 기준, ${usesDdareungi ? "따릉이 포함 " : ""}30일권 ${formatWon(passCost)}와 월 이용료 비교`
      : "서울 외 이동, 광역버스, 장거리 이동이 많으면 확인 필요";
  }

  if (benefit.type === "all-pass") {
    const isCapitalArea = ["서울", "경기", "인천"].includes(profile.region);
    const threshold = usesPlusTransit
      ? (isCapitalArea ? benefit.capitalPlusThreshold : benefit.localPlusThreshold)
      : (isCapitalArea ? benefit.capitalRegularThreshold : benefit.localRegularThreshold);
    estimatedSaving = usesDailyTransit && meetsRideMinimum ? Math.max(0, monthlyCost - threshold) : 0;
    formula = meetsRideMinimum
      ? `${usesPlusTransit ? "플러스형" : "일반형"} 기준 ${formatWon(threshold)} 초과 교통비 환급 예상`
      : `월 ${benefit.minMonthlyRides}회 이상 이용해야 비교 가능`;
  }

  if (benefit.type === "regional-refund") {
    estimatedSaving = ageOk && regionOk && districtOk && usesDailyTransit && meetsRideMinimum ? monthlyCost * benefit.refundRate : 0;
    if (benefit.maxMonthlyBenefit) estimatedSaving = Math.min(estimatedSaving, benefit.maxMonthlyBenefit);
    const refundPercent = Math.round((benefit.refundRate || 0) * 100);
    const cappedText = benefit.quarterlyCap
      ? `, 분기 최대 ${formatWon(benefit.quarterlyCap)}(월 비교용 최대 ${formatWon(benefit.maxMonthlyBenefit)})`
      : benefit.maxMonthlyBenefit ? `, 월 최대 ${formatWon(benefit.maxMonthlyBenefit)} 한도` : "";
    formula = meetsRideMinimum
      ? `${benefit.region} 거주·월 ${rides}회 이용 기준, 교통비 ${formatWon(monthlyCost)}의 약 ${refundPercent}% 환급 예상${cappedText}`
      : `월 ${benefit.minMonthlyRides}회 이상 이용해야 환급 가능`;
  }

  if (benefit.type === "long-distance") {
    formula = usesLongDistance
      ? `예매할 열차에 따라 운임의 ${benefit.discountRange} 할인 여부 확인`
      : "KTX를 이용할 때만 별도로 확인";
  }

  if (!ageOk || !regionOk || !districtOk) estimatedSaving = 0;

  let confidence = "낮음";
  if (replacedByRegionalPass) confidence = "경기패스로 확인";
  else if (benefit.type === "long-distance" && ageOk && usesLongDistance) confidence = "예매 시 확인";
  else if (ageOk && regionOk && !districtOk) confidence = "확인 필요";
  else if (ageOk && regionOk && districtOk && estimatedSaving > 0) confidence = "높음";
  else if (ageOk && regionOk) confidence = "확인 필요";

  const reasons = [
    ageOk ? "나이 조건 일치" : "나이 조건 확인 필요",
    regionOk ? "지역 조건 일치" : "지역 조건 확인 필요",
    requiredDistrict ? (districtOk ? `${requiredDistrict} 거주 조건 일치` : `${requiredDistrict} 거주 여부 공식 확인 필요`) : null,
    benefit.minMonthlyRides && !meetsRideMinimum ? `월 ${benefit.minMonthlyRides}회 이상 이용 필요` : null,
    replacedByRegionalPass ? "K-패스와 중복 지급되지 않음" : null,
    rides >= 40 ? "이동 빈도가 높음" : "이동 빈도 보통",
    modes.includes("metro-bus") ? "광역버스 이용 고려" : null,
    modes.includes("gtx") ? "GTX 이용 고려" : null,
    usesDdareungi ? "따릉이 이용 고려" : null,
    usesLongDistance ? "장거리 이동 고려" : null,
  ];

  return {
    ...benefit,
    ageOk,
    regionOk,
    confidence,
    estimatedSaving,
    formula,
    reason: reasons.filter(Boolean).join(" · "),
  };
}

function getComparedBenefits() {
  return benefits
    .map(calculateBenefit)
    .sort((a, b) => b.estimatedSaving - a.estimatedSaving);
}

function renderHome() {
  if (!state.comparedAt || !hasSavedProfile()) {
    document.getElementById("profileSummary").textContent = "아직 비교한 내역이 없어요.";
    document.getElementById("roadmap").innerHTML = `
      <h3>교통비 비교를 시작해볼까요?</h3>
      <p>내 정보와 이동 패턴을 입력하면, 내 조건 기준으로 혜택을 비교해드려요.</p>
      <button data-action="show" data-view-target="transport">교통비 비교 시작</button>`;
    document.getElementById("policyList").innerHTML = `
      <div class="empty-state">
        <p>입력한 조건 기준의 비교 결과가 여기에 표시돼요.</p>
      </div>`;
    return;
  }

  const profile = state.profile;
  const compared = getComparedBenefits();
  if (!compared.length) {
    document.getElementById("profileSummary").textContent = "공식 정책 데이터를 확인하고 있어요.";
    document.getElementById("roadmap").innerHTML = `
      <h3>${policyDataStatus === "loading" ? "정책 데이터를 불러오는 중이에요." : "현재 공식 확인 필요"}</h3>
      <p>${policyDataStatus === "unavailable" ? "정책 데이터베이스 연결, 공식 출처, 기준일, 갱신일 검토가 필요해요. 확인 전에는 추천하지 않습니다." : "검증된 공식 정책만 결과에 표시합니다."}</p>`;
    document.getElementById("policyList").innerHTML = `<div class="empty-state"><p>공식 출처 URL, 기준일, 갱신일이 확인된 active 정책만 비교 결과에 표시합니다.</p></div>`;
    return;
  }
  const best = compared.find((benefit) => benefit.estimatedSaving > 0 && benefit.confidence !== "확인 필요") || compared[0];

  document.getElementById("profileSummary").textContent =
    `${profile.age}세 · ${profile.region} · ${profile.mobilityArea || "서울 안"} · 월 ${formatWon(profile.monthlyTransitCost)} · ${profile.monthly15Rides === "yes" ? "월 15회 이상 이용" : profile.monthly15Rides === "no" ? "월 15회 미만 이용" : "이용 횟수 확인 필요"}`;
  document.getElementById("roadmap").innerHTML = `
    <h3>지금 비교해볼 혜택</h3>
    <p>${getRoadmap(profile.age, profile.status)}</p>
    <p class="muted">로드맵은 다음 비교 카테고리를 추천하는 역할이에요. MVP에서는 교통비 비교에 집중하고, 이후 주거·생활비·자산형성 비교로 확장합니다.</p>`;

  document.getElementById("policyList").innerHTML = `
    <article class="card best-card">
      <span class="badge">입력 조건 기준 예상 이득 높음</span>
      <h3>${best.title}</h3>
      <p class="saving">${getBenefitValueLabel(best)}</p>
      <p class="muted">${best.reason}</p>
      <p>${best.summary}</p>
      <p class="muted">${sourceMetaLine(best)}</p>
      <p class="muted">${applicationPeriodLine(best)}</p>
      <div class="actions">
        <button data-action="open-detail" data-benefit-id="${best.id}">비교 상세</button>
        <button data-action="save-benefit" data-benefit-id="${best.id}">저장</button>
        <button class="ghost" data-action="official-link" data-benefit-id="${best.id}">${getOfficialLinkLabel(best)}</button>
      </div>
    </article>
    ${compared
      .filter((benefit) => benefit.id !== best.id)
      .map(
        (benefit, index) => `
        <article class="card">
          <span class="badge">${index + 2}순위 · ${benefit.confidence}</span>
          <h3>${benefit.title}</h3>
          <p class="saving">${getBenefitValueLabel(benefit)}</p>
          <p class="muted">${benefit.formula}</p>
          <p>${benefit.reason}</p>
          <p class="muted">${sourceMetaLine(benefit)}</p>
          <p class="muted">${applicationPeriodLine(benefit)}</p>
          <div class="actions">
            <button data-action="open-detail" data-benefit-id="${benefit.id}">상세</button>
            <button data-action="save-benefit" data-benefit-id="${benefit.id}">저장</button>
            <button class="ghost" data-action="official-link" data-benefit-id="${benefit.id}">${getOfficialLinkLabel(benefit)}</button>
          </div>
        </article>`
      )
      .join("")}`;

  track("comparison_results_viewed", null, "results", {
    resultCount: compared.length,
    topBenefitId: best.id,
  });

  compared.forEach((benefit, index) =>
    track("comparison_result_view", benefit.id, "compare", {
      rank: index + 1,
      estimatedSaving: benefit.estimatedSaving,
      confidence: benefit.confidence,
    })
  );
}

function openDetail(id) {
  const benefit = getComparedBenefits().find((item) => item.id === id);
  if (!benefit) {
    showToast("현재 공식 확인 가능한 정책 정보를 찾지 못했어요.");
    return;
  }
  const documents = Array.isArray(benefit.documents) && benefit.documents.length
    ? benefit.documents
    : ["공식 기관 확인 필요"];
  const clickElapsedSeconds = state.comparedAt ? Math.round((Date.now() - state.comparedAt) / 1000) : null;
  track("benefit_card_click", id, "compare", { clickElapsedSeconds });
  track("benefit_detail_view", id, "detail");
  document.getElementById("policyDetail").innerHTML = `
    <div class="detail-box">
      <span class="badge">${benefit.category} · 입력 조건 기준</span>
      <h2>${benefit.title}</h2>
      <p class="saving">${getBenefitValueLabel(benefit)}</p>
      <p>${benefit.reason}</p>
      <p class="muted">${benefit.formula}</p>
    </div>
    <div class="card" data-reading-section="추천 이유">
      <h3>왜 이 선택이 유리한가요?</h3>
      <p>${benefit.summary}</p>
      <p><b>쉬운 말 설명</b>: 중복 수혜는 다른 지원과 같이 받을 수 있는지 확인하는 뜻이에요. 지역 제한은 해당 지역에 살거나 그 지역 대중교통을 이용해야 한다는 뜻이에요.</p>
      <p class="muted">${sourceMetaLine(benefit)}</p>
          <p class="muted">${applicationPeriodLine(benefit)}</p>
      <p class="notice">AI 설명은 참고용이며, 실제 신청 가능 여부와 혜택 금액은 공식 공고를 반드시 확인하세요.</p>
      <button data-action="simple-explanation" data-benefit-id="${benefit.id}">쉬운 설명 확인</button>
    </div>
    <div class="card" data-reading-section="주의사항·준비 항목">
      <h3>주의사항</h3>
      <p>${benefit.caution}</p>
      <ul>${documents.map((doc) => `<li>${doc}</li>`).join("")}</ul>
      <button data-action="documents" data-benefit-id="${benefit.id}">준비 항목 확인</button>
    </div>
    <div class="card" data-reading-section="피드백·공식 링크">
      <h3>피드백</h3>
      <p class="muted">어떤 부분이 헷갈렸는지 선택해주세요.</p>
      <div class="feedback-grid">
        <button data-action="feedback" data-benefit-id="${benefit.id}" data-feedback-type="calculation">예상 이득 계산이 헷갈려요</button>
        <button data-action="feedback" data-benefit-id="${benefit.id}" data-feedback-type="duplicate">다른 지원과 같이 받을 수 있는지 모르겠어요</button>
        <button data-action="feedback" data-benefit-id="${benefit.id}" data-feedback-type="condition">내 조건에 맞는지 모르겠어요</button>
        <button data-action="feedback" data-benefit-id="${benefit.id}" data-feedback-type="official_notice">공식 공고 문장이 어려워요</button>
      </div>
      <div class="actions">
        <button data-action="official-link" data-benefit-id="${benefit.id}">${getOfficialLinkLabel(benefit)}</button>
        <button data-action="save-benefit" data-benefit-id="${benefit.id}">저장</button>

      </div>
    </div>`;
  show("detail");
  startDetailReading(id);
}

function openApplyLink(id) {
  const benefit = benefits.find((item) => item.id === id);
  if (!benefit) return;
  const targetUrl = benefit.applicationUrl || benefit.sourceUrl;
  const elapsedSeconds = state.comparedAt ? Math.round((Date.now() - state.comparedAt) / 1000) : null;
  track("apply_link_click", id, "apply", { elapsedSeconds, sourceUrl: targetUrl });
  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
function saveBenefit(id) {
  if (!state.saved.includes(id)) state.saved.push(id);
  localStorage.setItem("bridge-saved", JSON.stringify(state.saved));
  track("benefit_save", id, "save");
  renderSaved();
  showToast("저장했어요. 저장/알림에서 다시 볼 수 있어요.");
}

function submitFeedback(id, type) {
  const labels = {
    calculation: "예상 이득 계산이 헷갈려요",
    duplicate: "다른 지원과 같이 받을 수 있는지 모르겠어요",
    condition: "내 조건에 맞는지 모르겠어요",
    official_notice: "공식 공고 문장이 어려워요",
  };
  track("confusion_click", id, "feedback");
  track("feedback_submit", id, "feedback", {
    type,
    label: labels[type],
  });
  showToast("피드백을 기록했어요. 정책 안내를 개선하는 데 활용돼요.");
}

function renderSaved() {
  const compared = getComparedBenefits();
  const savedBenefits = compared.filter((benefit) => state.saved.includes(benefit.id));
  document.getElementById("savedList").innerHTML =
    savedBenefits.length === 0
      ? `<p class="muted">저장한 혜택이 없습니다.</p>`
      : savedBenefits
          .map(
            (benefit) => `
            <article class="card">
              <span class="badge">저장/알림</span>
              <h3>${benefit.title}</h3>
              <p class="saving">${getBenefitValueLabel(benefit)}</p>              <p class="muted">${sourceMetaLine(benefit)}</p>
              <p class="muted">${applicationPeriodLine(benefit)}</p>
              <p class="muted">실제 푸시 대신 D-7 / D-3 / D-1 알림 화면만 표시합니다.</p>
              <button data-action="reminder" data-benefit-id="${benefit.id}">알림 확인</button>
            </article>`
          )
          .join("");
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(seconds || 0));
  if (value < 60) return `${value}초`;
  return `${Math.floor(value / 60)}분 ${value % 60}초`;
}

function metricRow(label, value, detail = "") {
  return `<div class="metric-row"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</div>`;
}

function countDistinctFlows(events, eventType, key = "comparisonId") {
  const values = new Set();
  events
    .filter((event) => event.eventType === eventType)
    .forEach((event) => values.add(event.metadata?.[key] || event.eventId));
  return values.size;
}

function conversionDetail(current, previous) {
  if (!previous) return "이전 단계 데이터 없음";
  return `이전 단계 대비 ${Math.round((current / previous) * 100)}%`;
}

function buildInterestSummary() {
  const benefitCategories = new Map(benefits.map((benefit) => [benefit.id, "교통비"]));
  activeCategoryPolicies.forEach((benefit) => {
    const category =
      benefit.category === "housing" ? "주거 지원" :
      benefit.category === "education" ? "교육·취업" :
      benefit.category === "saving" ? "자산형성" :
      benefit.category === "transport" ? "교통비" :
      activeCategory === "housing" ? "주거 지원" :
      activeCategory === "education" ? "교육·취업" :
      activeCategory === "saving" ? "자산형성" :
      null;
    if (category) benefitCategories.set(benefit.id, category);
  });
  const categories = new Map(["교통비", "주거 지원", "교육·취업", "자산형성"].map((name) => [name, { category: name, views: 0, saves: 0, links: 0, selects: 0 }]));
  state.logs.forEach((event) => {
    const category = benefitCategories.get(event.benefitId) || (event.metadata?.category === "housing" ? "주거 지원" : event.metadata?.category === "education" ? "교육·취업" : event.metadata?.category === "saving" ? "자산형성" : event.metadata?.category === "transport" ? "교통비" : null);
    if (!category) return;
    const item = categories.get(category);
    if (event.eventType === "benefit_detail_view" || event.eventType === "category_results_viewed") item.views += 1;
    if (event.eventType === "benefit_save") item.saves += 1;
    if (event.eventType === "apply_link_click" || event.eventType === "category_official_link_click") item.links += 1;
    if (event.eventType === "category_select") item.selects += 1;
  });
  return [...categories.values()]
    .map((item) => ({ ...item, score: item.views + item.selects + item.saves * 3 + item.links * 4 }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function getLocalInterestMessage(categories) {
  if (!categories.length) return "아직 관심 행동이 충분히 쌓이지 않았어요. 분야를 열어보거나 상세·공식 링크를 확인하면 관심 흐름을 요약해드려요.";
  const top = categories[0];
  const action = top.links ? "공식 안내까지 확인했어요" : top.saves ? "저장해 두고 다시 보려 했어요" : "비교 화면을 가장 자주 확인했어요";
  return `현재는 ${top.category} 분야에 가장 관심이 있어 보여요. ${action} 이 정보는 추천을 강요하지 않고, 다음에 어떤 분야를 먼저 보여줄지 정하는 데만 활용해요.`;
}

async function summarizeInterest() {
  const target = document.getElementById("interestSummary");
  const categories = buildInterestSummary();
  target.textContent = "관심 흐름을 요약하고 있어요...";
  track("interest_summary_request", null, "analytics", { categoryCount: categories.length });
  try {
    const response = await fetch("/api/interest-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    });
    if (!response.ok) throw new Error("Unable to summarize interest");
    const result = await response.json();
    target.textContent = result.summary;
  } catch {
    target.textContent = getLocalInterestMessage(categories);
  }
}

function renderLogs() {
  const events = state.logs;
  const dataSource = document.getElementById("dashboardDataSource");
  dataSource.textContent = serverLogState.connected
    ? `서버에 저장된 내 익명 이벤트 ${events.length}건을 보고 있어요.`
    : "현재는 이 브라우저에 저장된 이벤트를 보고 있어요. 서버로 실행하면 모든 이벤트를 함께 볼 수 있어요.";
  const detailViews = events.filter((event) => event.eventType === "benefit_detail_view");
  const detailExits = events.filter((event) => event.eventType === "detail_exit");
  const linkClicks = events.filter((event) => event.eventType === "apply_link_click");
  const feedbacks = events.filter((event) => event.eventType === "feedback_submit");
  const averageReadingSeconds = detailExits.length
    ? detailExits.reduce((sum, event) => sum + Number(event.metadata.durationSeconds || 0), 0) / detailExits.length
    : 0;
  const backCount = detailExits.filter((event) => event.metadata.exitAction === "back_button").length;
  const backRate = detailExits.length ? Math.round((backCount / detailExits.length) * 100) : 0;
  const formViews = countDistinctFlows(events, "transport_form_view", "formId");
  const compareFlows = countDistinctFlows(events, "compare_submit");
  const resultFlows = countDistinctFlows(events, "comparison_results_viewed");
  const detailFlows = countDistinctFlows(events, "benefit_detail_view");
  const linkFlows = countDistinctFlows(events, "apply_link_click");
  const inputDropOffs = events.filter(
    (event) => event.eventType === "transport_form_exit" && event.metadata.completed === false
  ).length;
  const benefitSignals = {};
  const getBenefitSignal = (benefitId) => {
    if (!benefitSignals[benefitId]) {
      benefitSignals[benefitId] = {
        benefitId,
        title: benefits.find((benefit) => benefit.id === benefitId)?.title || "알 수 없는 혜택",
        views: 0,
        feedbacks: 0,
        backs: 0,
        longDwells: 0,
        sectionSignals: {},
      };
    }
    return benefitSignals[benefitId];
  };
  detailViews.forEach((event) => getBenefitSignal(event.benefitId).views += 1);
  detailExits
    .filter((event) => event.metadata.exitAction === "back_button")
    .forEach((event) => getBenefitSignal(event.benefitId).backs += 1);
  const feedbackSections = {
    calculation: "추천 이유",
    duplicate: "주의사항·준비 항목",
    condition: "주의사항·준비 항목",
    official_notice: "주의사항·준비 항목",
  };
  feedbacks.forEach((event) => {
    const signal = getBenefitSignal(event.benefitId);
    const section = feedbackSections[event.metadata.type] || "피드백·공식 링크";
    signal.feedbacks += 1;
    signal.sectionSignals[section] = signal.sectionSignals[section] || { feedbacks: 0, longDwells: 0 };
    signal.sectionSignals[section].feedbacks += 1;
  });
  events
    .filter((event) => event.eventType === "detail_section_dwell" && Number(event.metadata.durationSeconds || 0) >= 15)
    .forEach((event) => {
      const signal = getBenefitSignal(event.benefitId);
      const section = event.metadata.section || "상세 설명";
      signal.longDwells += 1;
      signal.sectionSignals[section] = signal.sectionSignals[section] || { feedbacks: 0, longDwells: 0 };
      signal.sectionSignals[section].longDwells += 1;
    });

  const difficultySignals = Object.values(benefitSignals)
    .map((signal) => {
      const viewCount = Math.max(signal.views, 1);
      const feedbackRate = signal.feedbacks / viewCount;
      const backRate = signal.backs / viewCount;
      const longDwellRate = Math.min(1, signal.longDwells / viewCount);
      const score = Math.round(feedbackRate * 50 + backRate * 30 + longDwellRate * 20);
      const status = signal.views < 3 ? "판단 보류" : score >= 35 ? "개선 우선" : score >= 15 ? "확인 필요" : "낮음";
      const primarySection = Object.entries(signal.sectionSignals)
        .sort(([, a], [, b]) => (b.feedbacks * 2 + b.longDwells) - (a.feedbacks * 2 + a.longDwells))[0]?.[0];
      return { ...signal, score, status, primarySection };
    })
    .sort((a, b) => b.score - a.score);
  const topDifficultySignal = difficultySignals.find((signal) => signal.status !== "판단 보류");

  document.getElementById("dashboardSummary").innerHTML = [
    ["상세 설명 열람", `${detailViews.length}회`, "혜택 상세를 연 횟수"],
    ["평균 화면 체류 시간", formatDuration(averageReadingSeconds), "상세 화면이 열린 시간 기준"],
    ["개선 우선 대상", topDifficultySignal ? topDifficultySignal.status : "판단 보류", topDifficultySignal ? topDifficultySignal.title : "상세 확인 3회 이상 필요"],
    ["공식 링크 클릭", `${linkClicks.length}회`, "신청 정보 확인 행동"],
  ]
    .map(([label, value, detail]) => `<article class="dashboard-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`)
    .join("");

  document.getElementById("journeyMetrics").innerHTML = [
    metricRow("입력 화면 시작", `${formViews}건`, inputDropOffs ? `비교 전 이탈 ${inputDropOffs}건` : "입력 이탈 없음"),
    metricRow("조건 비교 실행", `${compareFlows}건`, conversionDetail(compareFlows, formViews)),
    metricRow("결과 확인", `${resultFlows}건`, conversionDetail(resultFlows, compareFlows)),
    metricRow("상세 설명 확인", `${detailFlows}건`, conversionDetail(detailFlows, resultFlows)),
    metricRow("공식 공고 이동", `${linkFlows}건`, conversionDetail(linkFlows, detailFlows)),
  ].join("");

  document.getElementById("readingMetrics").innerHTML = difficultySignals.length
    ? `${difficultySignals
        .map((signal) => {
          const detail = signal.views < 3
            ? `상세 확인 ${signal.views}/3회 · 충분한 데이터가 쌓이면 판단`
            : `먼저 확인할 곳: ${signal.primarySection || "상세 전체"} · 피드백 ${signal.feedbacks} · 목록 복귀 ${signal.backs} · 15초 이상 체류 ${signal.longDwells}`;
          return metricRow(`${signal.title} · ${signal.status}`, signal.views < 3 ? "-" : `${signal.score}점`, detail);
        })
        .join("")}<p class="muted dashboard-method">점수는 피드백(50%), 목록 복귀(30%), 15초 이상 체류(20%)를 함께 봅니다.</p>`
    : `<p class="muted">아직 상세 설명을 본 기록이 없어요.</p>`;

  const feedbackTotals = {};
  feedbacks.forEach((event) => {
    const label = event.metadata.label || "기타";
    feedbackTotals[label] = (feedbackTotals[label] || 0) + 1;
  });
  const feedbackRows = Object.entries(feedbackTotals).sort((a, b) => b[1] - a[1]);
  document.getElementById("feedbackMetrics").innerHTML = feedbackRows.length
    ? feedbackRows.map(([label, count]) => metricRow(label, `${count}회`)).join("")
    : `<p class="muted">아직 제출된 피드백이 없어요.</p>`;
}

async function clearLogs() {
  if (!window.confirm("이 브라우저에 저장된 이용 로그를 초기화할까요?")) return;
  state.logs = [];
  localStorage.setItem("bridge-logs", JSON.stringify(state.logs));
  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/events", { method: "DELETE" });
      serverLogState.connected = response.ok;
    } catch {
      serverLogState.connected = false;
    }
  }
  renderLogs();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => show(button.dataset.view));
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => selectCategory(button.dataset.category));
});

document.getElementById("costRange").addEventListener("change", syncCostInputState);
document.getElementById("mobilityArea").addEventListener("change", syncConditionalInputs);
document.getElementById("saveProfile").addEventListener("click", saveProfile);
document.getElementById("compareTransport").addEventListener("click", compareTransport);
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const benefitId = button.dataset.benefitId || null;
  switch (button.dataset.action) {
    case "back": goBack(button.dataset.fallback || "categories"); break;
    case "detail-back": goBackFromDetail(); break;
    case "show": show(button.dataset.viewTarget); break;
    case "category-link": openCategoryBenefit(benefitId); break;
    case "open-detail": openDetail(benefitId); break;
    case "save-benefit": saveBenefit(benefitId); break;
    case "official-link": openApplyLink(benefitId); break;
    case "simple-explanation": track("simple_explanation_view", benefitId, "detail"); break;
    case "documents": track("documents_view", benefitId, "documents"); break;
    case "feedback": submitFeedback(benefitId, button.dataset.feedbackType); break;
    case "reminder": track("reminder_view", benefitId, "reminder"); break;
    case "clear-logs": clearLogs(); break;
    case "summarize-interest": summarizeInterest(); break;
  }
});
window.addEventListener("scroll", updateDetailScrollDepth, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") pauseDetailReading();
  else resumeDetailReading();
});
window.addEventListener("pagehide", () => finishDetailReading("page_leave"));

if (state.profile) {
  document.getElementById("age").value = state.profile.age;
  document.getElementById("region").value = state.profile.region;
  document.getElementById("district").value = state.profile.district || "";
  document.getElementById("status").value = state.profile.status || "재학 중";
  const savedCostRange = state.profile.costRange;
  const validCostRanges = ["40000", "60000", "85000", "110000", "direct"];
  document.getElementById("costRange").value = validCostRanges.includes(savedCostRange) ? savedCostRange : "direct";
  document.getElementById("monthlyTransitCost").value = state.profile.monthlyTransitCost || "";
  document.getElementById("mobilityArea").value = state.profile.mobilityArea || "서울 안";
  document.getElementById("monthly15Rides").value = state.profile.monthly15Rides || "yes";
  document.getElementById("usesPlusTransit").value = state.profile.usesPlusTransit || "no";
  document.getElementById("bikeUsage").value = state.profile.bikeUsage || "no";
  document.getElementById("longDistanceUse").value = state.profile.longDistanceUse || "no";
  document.getElementById("income").value = state.profile.income || "잘 모르겠어요";
  document.getElementById("housing").value = state.profile.housing || "잘 모르겠어요";
}

syncCostInputState();
syncConditionalInputs();
renderLogs();
syncEventsWithServer();
loadPolicies();










