function getAllowedOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin") || "";
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGIN") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!allowedOrigins.length) return "*";
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return allowedOrigins[0];
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(request),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

type LeadCapturePayload = {
  organization_id?: string;
  fb_lead_id?: string;
  fb_created_time?: string;
  nome?: string;
  telefone?: string;
  telefone_com_ddd?: string;
  answers?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  status?: string;
  origem?: string;
  plataforma?: string;
};

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function onlyDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBrazilPhone(value?: string | null) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "";
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "";
}

async function buildMetaUserData(payload: LeadCapturePayload, request: Request) {
  const raw = payload.raw || {};
  const metaUserData = (raw.meta_user_data || {}) as Record<string, unknown>;
  const phone = normalizeBrazilPhone(payload.telefone_com_ddd || payload.telefone);
  const userAgent = String(raw.user_agent || request.headers.get("user-agent") || "");
  const ip = getClientIp(request);
  const result: Record<string, string | string[]> = {};

  if (phone) result.ph = [await sha256(phone)];
  if (userAgent) result.client_user_agent = userAgent;
  if (ip) result.client_ip_address = ip;
  if (metaUserData.fbp) result.fbp = String(metaUserData.fbp);
  if (metaUserData.fbc) result.fbc = String(metaUserData.fbc);
  if (payload.fb_lead_id) result.external_id = [await sha256(payload.fb_lead_id)];

  return result;
}

function getServiceRoleKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeys) return "";

  return JSON.parse(secretKeys).default || "";
}

async function saveLeadCapture(payload: LeadCapturePayload) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) throw new Error("Missing required secret: SUPABASE_SERVICE_ROLE_KEY");

  if (payload.organization_id && payload.fb_lead_id) {
    const organizationId = encodeURIComponent(payload.organization_id);
    const leadId = encodeURIComponent(payload.fb_lead_id);
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/lead_captures?organization_id=eq.${organizationId}&fb_lead_id=eq.${leadId}&select=*`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      },
    );

    const updateBody = await updateResponse.text();
    if (!updateResponse.ok) throw new Error(`Supabase update failed: ${updateBody}`);

    const rows = JSON.parse(updateBody || "[]");
    if (rows[0]) return rows[0] as Record<string, unknown>;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/lead_captures`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase insert failed: ${body}`);
  return JSON.parse(body)[0] as Record<string, unknown>;
}

async function getMetaIntegration(payload: LeadCapturePayload) {
  const fallback = {
    token: Deno.env.get("META_CAPI_TOKEN") || "",
    pixelId: Deno.env.get("META_PIXEL_ID") || "",
    apiVersion: Deno.env.get("META_API_VERSION") || "v22.0",
  };
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey || !payload.organization_id) return fallback;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/meta_capi_integrations?organization_id=eq.${payload.organization_id}&enabled=eq.true&select=pixel_id,access_token,api_version&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!response.ok) return fallback;

    const rows = await response.json();
    const integration = rows?.[0];
    if (!integration?.pixel_id || !integration?.access_token) return fallback;

    return {
      token: String(integration.access_token),
      pixelId: String(integration.pixel_id),
      apiVersion: String(integration.api_version || fallback.apiVersion),
    };
  } catch (error) {
    console.error("Meta integration lookup failed", error);
    return fallback;
  }
}

async function sendMetaLeadEvent(payload: LeadCapturePayload, request: Request) {
  const integration = await getMetaIntegration(payload);
  if (!integration.token || !integration.pixelId) {
    throw new Error("Missing Meta CAPI integration for this organization.");
  }

  const raw = payload.raw || {};
  const eventId = String(raw.event_id || raw.capture_id || payload.fb_lead_id || crypto.randomUUID());
  const eventTime = payload.fb_created_time
    ? Math.floor(new Date(payload.fb_created_time).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Lead",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: String(raw.page_url || ""),
        user_data: await buildMetaUserData(payload, request),
        custom_data: {
          lead_source: "quiz_verano_casas",
        },
      },
    ],
  };

  const testEventCode = Deno.env.get("META_TEST_EVENT_CODE");
  if (testEventCode) body.test_event_code = testEventCode;

  const response = await fetch(
    `https://graph.facebook.com/${integration.apiVersion}/${integration.pixelId}/events?access_token=${encodeURIComponent(integration.token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(`Meta CAPI failed: ${JSON.stringify(responseBody)}`);
  return responseBody as Record<string, unknown>;
}

function normalizePayload(payload: LeadCapturePayload) {
  const now = new Date().toISOString();
  const captureId = payload.fb_lead_id || `verano-${crypto.randomUUID()}`;
  const raw = payload.raw || {};

  return {
    ...payload,
    fb_lead_id: captureId,
    fb_created_time: payload.fb_created_time || now,
    nome: String(payload.nome || "").trim(),
    telefone: onlyDigits(payload.telefone),
    telefone_com_ddd: onlyDigits(payload.telefone_com_ddd || payload.telefone),
    answers: payload.answers || {},
    raw: {
      ...raw,
      event_id: raw.event_id || captureId,
      capture_id: raw.capture_id || captureId,
    },
    status: payload.status || "capturado",
    origem: payload.origem || "quiz_verano_casas",
    plataforma: payload.plataforma || "site",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  try {
    const payload = normalizePayload(await request.json());

    if (!payload.organization_id || !payload.nome || !payload.telefone) {
      return jsonResponse(request, { error: "Missing required lead fields" }, 400);
    }

    const lead = await saveLeadCapture(payload);
    let meta: Record<string, unknown> = { sent: false };

    try {
      meta = {
        sent: true,
        response: await sendMetaLeadEvent(payload, request),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Meta CAPI error";
      console.error(message);
      meta = { sent: false, error: message };
    }

    return jsonResponse(request, {
      ok: true,
      lead_id: lead.id,
      event_id: payload.raw.event_id,
      meta,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error(message);
    return jsonResponse(request, { error: message }, 500);
  }
});
