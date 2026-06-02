const totalVisibleSteps = 6;
const successStep = 7;
const optionGroups = {
  renda_familiar: [
    ["De R$ 15 mil a R$ 20 mil", "", ""],
    ["De R$ 20 mil a R$ 30 mil", "", ""],
    ["De R$ 30 mil a R$ 50 mil", "", ""],
    ["Acima de R$ 50 mil", "", ""],
  ],
  regiao_interesse: [
    ["Morros", "Quero avaliar casas nessa região.", "pin"],
    ["Uruguai", "Quero opções no Uruguai e proximidades.", "pin"],
    ["Região Alpha (Próximo ao Alphaville)", "Quero avaliar oportunidades na Região Alpha.", "pin"],
    ["Estou aberto", "Quero que a Verano indique as melhores opções.", "pin"],
  ],
  prazo_compra: [
    ["Imediato", "Já quero receber opções disponíveis e visitar.", ""],
    ["30 a 60 dias", "Estou em fase de decisão.", ""],
    ["3 a 6 meses", "Quero me planejar com calma.", ""],
    ["Apenas pesquisando", "Quero entender valores e possibilidades.", ""],
  ],
  faixa_investimento: [
    ["R$ 500 mil a R$ 700 mil", "Quero entender o que existe nessa faixa.", ""],
    ["R$ 700 mil a R$ 800 mil", "Busco opções dentro desse intervalo.", ""],
    ["R$ 800 mil a R$ 1 mi", "Quero casas mais completas e bem localizadas.", ""],
    ["Acima de R$ 1 mi", "Quero opções mais exclusivas.", ""],
  ],
  proximo_passo: [
    ["Quero agendar uma visita", "Conhecer pessoalmente as casas e condomínios disponíveis.", ""],
    ["Quero iniciar minha análise de crédito", "Enviar meus dados para verificar aprovação e condições de financiamento.", ""],
    ["Quero receber mais informações", "Entender melhor os imóveis antes de escolher uma visita.", ""],
    ["Quero ver outras opções de casas", "Comparar imóveis e encontrar a melhor opção para meu perfil.", ""],
  ],
};

const thankYouContent = {
  "Quero agendar uma visita": {
    title: "Perfeito! Vamos organizar sua visita",
    subtitle: "Nossa equipe vai te chamar no WhatsApp para alinhar horários, localização e detalhes dos imóveis.",
    button: "Agendar visita no WhatsApp",
  },
  "Quero iniciar minha análise de crédito": {
    title: "Ótimo! Vamos iniciar sua análise",
    subtitle: "Nossa equipe vai te chamar no WhatsApp para enviar a lista de documentos necessários e orientar sua análise de crédito.",
    button: "Iniciar análise no WhatsApp",
  },
  "Quero receber mais informações": {
    title: "Perfeito! Vamos te mostrar mais detalhes",
    subtitle: "Nossa equipe vai enviar no WhatsApp informações completas sobre os imóveis alinhados ao seu perfil.",
    button: "Receber informações no WhatsApp",
  },
  "Quero ver outras opções de casas": {
    title: "Vamos separar novas opções para você",
    subtitle: "Nossa equipe já está selecionando imóveis compatíveis com seu perfil e faixa de investimento.",
    button: "Ver opções no WhatsApp",
  },
};

const defaultThankYou = {
  title: "Resumo pronto para enviar",
  subtitle: "A Verano já consegue entender seu perfil e separar opções mais alinhadas.",
  button: "Falar com a Verano",
};

const requiredByStep = {
  2: "renda_familiar",
  3: "regiao_interesse",
  4: "prazo_compra",
  5: "faixa_investimento",
  6: "proximo_passo",
};

const form = document.getElementById("leadForm");
const steps = [...document.querySelectorAll(".step")];
const currentStepText = document.getElementById("currentStep");
const totalStepsText = document.getElementById("totalSteps");
const progressBar = document.getElementById("progressBar");
const formError = document.getElementById("formError");
const actions = document.getElementById("actions");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const whatsappBtn = document.getElementById("whatsappBtn");
const summaryBox = document.getElementById("summaryBox");
const thankYouTitle = document.getElementById("thankYouTitle");
const thankYouSubtitle = document.getElementById("thankYouSubtitle");

const state = {
  step: 1,
  captureId: createCaptureId(),
  partialLeadSubmitted: false,
  finalLeadSubmitted: false,
  partialSubmitPromise: null,
  finalSubmitPromise: null,
  pixelLeadTracked: false,
  answers: {},
};

totalStepsText.textContent = String(totalVisibleSteps);
renderOptions();
showStep(1);

nextBtn.addEventListener("click", handleNext);
backBtn.addEventListener("click", handleBack);
whatsappBtn.addEventListener("click", openWhatsApp);
form.addEventListener("input", () => clearError());

function renderOptions() {
  Object.entries(optionGroups).forEach(([field, options]) => {
    const container = document.querySelector(`[data-field="${field}"]`);
    if (!container) return;

    container.innerHTML = options.map(([title, desc, icon]) => `
      <button class="option${icon ? "" : " option-plain"}" type="button" data-field="${field}" data-value="${escapeHtml(title)}">
        ${icon === "pin" ? '<span class="option-icon option-pin" aria-hidden="true"></span>' : ""}
        <span>
          <strong class="option-title">${escapeHtml(title)}</strong>
          ${desc ? `<span class="option-desc">${escapeHtml(desc)}</span>` : ""}
        </span>
        <span class="option-check" aria-hidden="true"></span>
      </button>
    `).join("");
  });

  document.querySelectorAll(".option").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.dataset.field;
      const value = button.dataset.value;
      state.answers[field] = value;

      document.querySelectorAll(`.option[data-field="${field}"]`).forEach((option) => {
        option.classList.toggle("selected", option === button);
      });

      clearError();
    });
  });
}

function handleNext() {
  if (!validateStep(state.step)) return;

  if (state.step === 1) {
    queuePartialLeadCapture();
  }

  if (state.step < totalVisibleSteps) {
    showStep(state.step + 1);
    return;
  }

  buildSummary();
  queueLeadCapture();
  showStep(successStep);
}

function handleBack() {
  if (state.step <= 1) return;
  showStep(state.step - 1);
}

function showStep(step) {
  state.step = step;
  steps.forEach((section) => {
    section.classList.toggle("active", Number(section.dataset.step) === step);
  });

  const progressStep = Math.min(step, totalVisibleSteps);
  currentStepText.textContent = String(progressStep);
  progressBar.style.width = `${(progressStep / totalVisibleSteps) * 100}%`;
  backBtn.style.visibility = step > 1 && step !== successStep ? "visible" : "hidden";
  actions.style.display = step === successStep ? "none" : "flex";
  clearError();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateStep(step) {
  if (step === 1) {
    const name = getInputValue("nome");
    const phone = onlyDigits(getInputValue("telefone"));
    const phoneConfirmation = onlyDigits(getInputValue("telefoneConfirmacao"));

    if (name.length < 2) return showError("Digite seu nome para continuar.");
    if (phone.length < 10) return showError("Digite um WhatsApp com DDD.");
    if (phone !== phoneConfirmation) return showError("Os números de WhatsApp não conferem.");

    return true;
  }

  const field = requiredByStep[step];
  if (field && !state.answers[field]) {
    return showError("Selecione uma opção para continuar.");
  }

  return true;
}

function getInputValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function showError(message) {
  formError.textContent = message;
  return false;
}

function clearError() {
  formError.textContent = "";
}

function createCaptureId() {
  if (window.crypto?.randomUUID) return `verano-${window.crypto.randomUUID()}`;
  return `verano-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBrazilPhone(value) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function getTrackingParams() {
  const params = new URLSearchParams(window.location.search);
  return [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
  ].reduce((tracking, key) => {
    const value = params.get(key);
    if (value) tracking[key] = value;
    return tracking;
  }, {});
}

function getCookie(name) {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

function getFacebookClickId(tracking) {
  const fbcCookie = getCookie("_fbc");
  if (fbcCookie) return decodeURIComponent(fbcCookie);
  if (!tracking.fbclid) return "";
  return `fb.1.${Date.now()}.${tracking.fbclid}`;
}

function getMetaUserData(tracking) {
  return {
    fbp: decodeURIComponent(getCookie("_fbp") || ""),
    fbc: getFacebookClickId(tracking),
  };
}

function getLeadData() {
  const tracking = getTrackingParams();
  const phone = normalizeBrazilPhone(getInputValue("telefone"));
  const answers = {
    nome: getInputValue("nome"),
    telefone: phone,
    renda_familiar: state.answers.renda_familiar,
    regiao_interesse: state.answers.regiao_interesse,
    prazo_compra: state.answers.prazo_compra,
    faixa_investimento: state.answers.faixa_investimento,
    proximo_passo: state.answers.proximo_passo,
    ...tracking,
  };

  return {
    tracking,
    answers,
    phone,
    name: getInputValue("nome"),
  };
}

function buildLeadCapture(stage = "completed") {
  const lead = getLeadData();
  const capturedAt = new Date().toISOString();
  const isPartial = stage === "partial";

  return {
    organization_id: window.quizConfig.organizationId,
    fb_lead_id: state.captureId,
    fb_created_time: capturedAt,
    nome: lead.name,
    telefone: lead.phone,
    telefone_com_ddd: lead.phone,
    answers: lead.answers,
    raw: {
      source: "quiz_verano_casas",
      page_url: window.location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      captured_at: capturedAt,
      capture_stage: stage,
      capture_id: state.captureId,
      event_id: state.captureId,
      tracking: lead.tracking,
      meta_user_data: getMetaUserData(lead.tracking),
      answers: lead.answers,
    },
    status: isPartial ? "parcial" : "capturado",
    origem: "quiz_verano_casas",
    plataforma: "site",
  };
}

async function submitPartialLeadCapture() {
  if (state.partialLeadSubmitted) return;
  if (state.partialSubmitPromise) return state.partialSubmitPromise;

  const config = window.quizConfig || {};
  const payload = buildLeadCapture("partial");

  state.partialSubmitPromise = sendLeadCapture(payload, "", config, true)
    .then(() => {
      state.partialLeadSubmitted = true;
    })
    .finally(() => {
      state.partialSubmitPromise = null;
    });

  return state.partialSubmitPromise;
}

async function submitLeadCapture() {
  if (state.finalLeadSubmitted) return;
  if (state.finalSubmitPromise) return state.finalSubmitPromise;

  const config = window.quizConfig || {};
  const payload = buildLeadCapture("completed");
  const endpoint = String(config.leadCaptureEndpoint || "").trim();

  if (state.partialSubmitPromise) {
    await state.partialSubmitPromise.catch(() => undefined);
  }

  const updateExistingLead = state.partialLeadSubmitted
    ? updateLeadCapture(payload, config)
    : Promise.reject(new Error("Lead parcial ainda não salvo."));

  state.finalSubmitPromise = updateExistingLead
    .catch((error) => {
      console.error("Atualização do lead parcial indisponível. Tentando captura final.", error);
      return sendLeadCapture(payload, endpoint, config).catch((endpointError) => {
        if (!endpoint) throw endpointError;
        console.error("Endpoint de captura indisponível. Tentando fallback REST.", endpointError);
        return sendLeadCapture(payload, "", config, true);
      });
    })
    .then(() => {
      state.finalLeadSubmitted = true;
      trackLeadPixel();
    })
    .finally(() => {
      state.finalSubmitPromise = null;
    });

  return state.finalSubmitPromise;
}

async function sendLeadCapture(payload, endpoint, config, forceSupabaseRest = false) {
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const target = endpoint || `${baseUrl}/rest/v1/${config.leadCaptureTable}`;
  const isSupabaseRest = forceSupabaseRest || target.includes("/rest/v1/");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4200);

  const headers = isSupabaseRest
    ? {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }
    : { "Content-Type": "application/json" };

  try {
    const response = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Não foi possível salvar o lead.");
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateLeadCapture(payload, config) {
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const table = config.leadCaptureTable;
  const organizationId = encodeURIComponent(payload.organization_id);
  const leadId = encodeURIComponent(payload.fb_lead_id);
  const target = `${baseUrl}/rest/v1/${table}?organization_id=eq.${organizationId}&fb_lead_id=eq.${leadId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4200);

  try {
    const response = await fetch(target, {
      method: "PATCH",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Não foi possível atualizar o lead.");
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function queuePartialLeadCapture() {
  submitPartialLeadCapture().catch((error) => {
    console.error("Falha ao salvar lead parcial em segundo plano.", error);
  });
}

function queueLeadCapture() {
  submitLeadCapture().catch((error) => {
    console.error("Falha ao salvar lead em segundo plano.", error);
  });
}

function trackLeadPixel() {
  if (state.pixelLeadTracked || typeof window.fbq !== "function") return;
  window.fbq("track", "Lead", {}, { eventID: state.captureId });
  state.pixelLeadTracked = true;
}

function buildSummary() {
  const lead = getLeadData();
  const content = thankYouContent[state.answers.proximo_passo] || defaultThankYou;

  thankYouTitle.textContent = content.title;
  thankYouSubtitle.textContent = content.subtitle;
  whatsappBtn.textContent = content.button;

  summaryBox.innerHTML = `
    <strong>Nome:</strong> ${escapeHtml(lead.name)}<br>
    <strong>WhatsApp:</strong> ${escapeHtml(lead.phone)}<br>
    <strong>Renda familiar:</strong> ${escapeHtml(state.answers.renda_familiar)}<br>
    <strong>Região:</strong> ${escapeHtml(state.answers.regiao_interesse)}<br>
    <strong>Prazo:</strong> ${escapeHtml(state.answers.prazo_compra)}<br>
    <strong>Investimento:</strong> ${escapeHtml(state.answers.faixa_investimento)}<br>
    <strong>Próximo passo:</strong> ${escapeHtml(state.answers.proximo_passo)}
  `;
}

function buildWhatsAppMessage() {
  const lead = getLeadData();
  return [
    `Olá! Meu nome é ${lead.name}.`,
    "",
    "Acabei de responder o formulário da Verano sobre casas em condomínio em Teresina e gostaria de atendimento.",
    "",
    `WhatsApp: ${lead.phone}`,
    `Renda familiar: ${state.answers.renda_familiar}`,
    `Região de interesse: ${state.answers.regiao_interesse}`,
    `Prazo de compra: ${state.answers.prazo_compra}`,
    `Faixa de investimento: ${state.answers.faixa_investimento}`,
    `Próximo passo desejado: ${state.answers.proximo_passo}`,
  ].join("\n");
}

function openWhatsApp() {
  queueLeadCapture();
  trackLeadPixel();

  const number = onlyDigits(window.quizConfig.whatsappNumber);
  const message = encodeURIComponent(buildWhatsAppMessage());

  if (!number) {
    console.error("Número de WhatsApp não configurado.");
    return;
  }

  window.location.href = `https://wa.me/${number}?text=${message}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
