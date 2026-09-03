import { createClient } from "npm:@supabase/supabase-js@2";

type Provider = "whatsapp" | "instagram";
type Json = Record<string, unknown>;

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function env(name: string) {
  return Deno.env.get(name) ?? "";
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function hexToBytes(hex: string) {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) return new Uint8Array();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  return bytes;
}

async function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = env("META_APP_SECRET");
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

  const signature = hexToBytes(signatureHeader.slice(7));
  if (!signature.length) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(rawBody));
}

async function resolveIntegration(provider: Provider, externalAccountId: string) {
  const direct = await supabase
    .from("erj_integrations")
    .select("id, tenant_id, provider, status, external_account_id, config")
    .eq("provider", provider)
    .eq("external_account_id", externalAccountId)
    .maybeSingle();

  if (direct.error) throw direct.error;
  if (direct.data) return direct.data;

  const pending = await supabase
    .from("erj_integrations")
    .select("id, tenant_id, provider, status, external_account_id, config")
    .eq("provider", provider)
    .is("external_account_id", null)
    .limit(2);

  if (pending.error) throw pending.error;
  if ((pending.data ?? []).length !== 1) return null;

  const candidate = pending.data![0];
  const bound = await supabase
    .from("erj_integrations")
    .update({
      external_account_id: externalAccountId,
      status: "connected",
      last_sync_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", candidate.id)
    .select("id, tenant_id, provider, status, external_account_id, config")
    .single();

  if (bound.error) throw bound.error;
  return bound.data;
}

async function logWebhookEvent(input: {
  tenantId: string | null;
  provider: Provider;
  externalEventId: string;
  externalAccountId: string;
  eventType: string;
  payload: unknown;
}) {
  const result = await supabase
    .from("erj_webhook_events")
    .insert({
      tenant_id: input.tenantId,
      provider: input.provider,
      external_event_id: input.externalEventId,
      external_account_id: input.externalAccountId,
      event_type: input.eventType,
      payload: input.payload,
      status: "received",
    })
    .select("id")
    .single();

  if (result.error?.code === "23505") return { duplicate: true, id: null as string | null };
  if (result.error) throw result.error;
  return { duplicate: false, id: result.data.id as string };
}

async function finishWebhookEvent(id: string | null, status: "processed" | "ignored" | "error", error?: string) {
  if (!id) return;
  await supabase
    .from("erj_webhook_events")
    .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
    .eq("id", id);
}

async function touchIntegration(id: string, status: "connected" | "error", lastError: string | null = null) {
  await supabase
    .from("erj_integrations")
    .update({ status, last_sync_at: new Date().toISOString(), last_error: lastError })
    .eq("id", id);
}

async function touchTenantIntegration(
  tenantId: string,
  provider: "openai",
  status: "connected" | "error",
  lastError: string | null = null,
) {
  await supabase
    .from("erj_integrations")
    .update({ status, last_sync_at: new Date().toISOString(), last_error: lastError })
    .eq("tenant_id", tenantId)
    .eq("provider", provider);
}

async function findOrCreateContact(input: {
  tenantId: string;
  provider: Provider;
  externalContactId: string;
  displayName?: string | null;
  username?: string | null;
  at: string;
}) {
  const column = input.provider === "whatsapp" ? "phone" : "instagram_scoped_id";
  const externalValue = input.provider === "whatsapp" ? normalizePhone(input.externalContactId) : input.externalContactId;

  const existing = await supabase
    .from("erj_contacts")
    .select("id, name, phone, instagram_scoped_id, opted_out_at")
    .eq("tenant_id", input.tenantId)
    .eq(column, externalValue)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    const patch: Json = { last_interaction_at: input.at };
    if (!existing.data.name && input.displayName) patch.name = input.displayName;
    if (input.provider === "instagram" && input.username) patch.instagram_username = input.username;

    const updated = await supabase.from("erj_contacts").update(patch).eq("id", existing.data.id).select("*").single();
    if (updated.error) throw updated.error;
    return updated.data;
  }

  const payload: Json = {
    tenant_id: input.tenantId,
    name: input.displayName ?? null,
    source: input.provider,
    last_interaction_at: input.at,
    metadata: {},
  };

  if (input.provider === "whatsapp") payload.phone = externalValue;
  else {
    payload.instagram_scoped_id = externalValue;
    payload.instagram_username = input.username ?? null;
  }

  const created = await supabase.from("erj_contacts").insert(payload).select("*").single();
  if (!created.error) return created.data;

  if (created.error.code === "23505") {
    const raced = await supabase
      .from("erj_contacts")
      .select("*")
      .eq("tenant_id", input.tenantId)
      .eq(column, externalValue)
      .single();
    if (raced.error) throw raced.error;
    return raced.data;
  }

  throw created.error;
}

async function findOrCreateConversation(tenantId: string, contactId: string, provider: Provider, at: string) {
  const existing = await supabase
    .from("erj_conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", provider)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    const updated = await supabase
      .from("erj_conversations")
      .update({ last_message_at: at, last_customer_message_at: at })
      .eq("id", existing.data.id)
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    return updated.data;
  }

  const created = await supabase
    .from("erj_conversations")
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: provider,
      status: "open",
      last_message_at: at,
      last_customer_message_at: at,
      metadata: {},
    })
    .select("*")
    .single();

  if (!created.error) return created.data;
  if (created.error.code === "23505") {
    const raced = await supabase
      .from("erj_conversations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("channel", provider)
      .eq("contact_id", contactId)
      .single();
    if (raced.error) throw raced.error;
    return raced.data;
  }
  throw created.error;
}

async function createTask(tenantId: string, contactId: string, title: string, priority: "normal" | "high" = "normal") {
  await supabase.from("erj_tasks").insert({
    tenant_id: tenantId,
    contact_id: contactId,
    title,
    priority,
    status: "open",
  });
}

function messageBody(provider: Provider, raw: any) {
  if (provider === "whatsapp") {
    if (raw?.type === "text") return raw?.text?.body ?? "";
    if (raw?.type === "button") return raw?.button?.text ?? "";
    if (raw?.type === "interactive") return raw?.interactive?.button_reply?.title ?? raw?.interactive?.list_reply?.title ?? "";
    return raw?.image?.caption ?? raw?.video?.caption ?? raw?.document?.caption ?? "";
  }
  return raw?.message?.text ?? "";
}

async function sendWhatsAppText(phoneNumberId: string, to: string, text: string) {
  const token = env("WHATSAPP_ACCESS_TOKEN");
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN não configurado");
  const version = env("WHATSAPP_GRAPH_VERSION") || "v26.0";

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`WhatsApp API ${response.status}: ${JSON.stringify(data)}`);
  return { data, messageId: data?.messages?.[0]?.id ?? null };
}

async function sendInstagramText(accountId: string, recipientId: string, text: string) {
  const token = env("INSTAGRAM_ACCESS_TOKEN");
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN não configurado");
  const version = env("INSTAGRAM_GRAPH_VERSION") || "v26.0";
  const host = env("INSTAGRAM_GRAPH_HOST") || "https://graph.instagram.com";

  const response = await fetch(`${host}/${version}/${accountId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Instagram API ${response.status}: ${JSON.stringify(data)}`);
  return { data, messageId: data?.message_id ?? data?.id ?? null };
}

function extractOpenAIText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts: string[] = [];
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

async function generateAIReply(input: {
  tenantId: string;
  conversationId: string;
  contactId: string;
  agent: any;
}) {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const maxHistory = Math.max(1, Math.min(50, Number(input.agent.max_history_messages ?? 20)));
  const historyResult = await supabase
    .from("erj_messages")
    .select("direction, sender_type, body, created_at")
    .eq("conversation_id", input.conversationId)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(maxHistory);
  if (historyResult.error) throw historyResult.error;

  const eventsResult = await supabase
    .from("erj_events")
    .select("name, description, starts_at, ends_at, venue_name, address, ticket_url, reservation_url, status")
    .eq("tenant_id", input.tenantId)
    .gte("starts_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);
  if (eventsResult.error) throw eventsResult.error;

  const reservationsResult = await supabase
    .from("erj_reservations")
    .select("event_id, customer_name, guests, table_label, sector, status, deposit_amount, deposit_status, notes")
    .eq("tenant_id", input.tenantId)
    .eq("contact_id", input.contactId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (reservationsResult.error) throw reservationsResult.error;

  const context = [
    "DADOS ATUAIS DO SISTEMA (use somente quando forem relevantes):",
    `Eventos: ${JSON.stringify(eventsResult.data ?? [])}`,
    `Reservas deste contato: ${JSON.stringify(reservationsResult.data ?? [])}`,
    "Se um dado necessário não estiver acima, diga que vai encaminhar para a equipe em vez de inventar.",
  ].join("\n");

  const inputMessages = [...(historyResult.data ?? [])]
    .reverse()
    .filter((item) => typeof item.body === "string" && item.body.trim())
    .map((item) => ({
      role: item.direction === "inbound" ? "user" : "assistant",
      content: item.body,
    }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: input.agent.model || env("OPENAI_MODEL") || "gpt-5.6-luna",
      store: false,
      max_output_tokens: 260,
      instructions: `${input.agent.instructions}\n\n${context}\n\nResponda em no máximo 3 mensagens curtas condensadas em um único texto. Não use markdown excessivo.`,
      input: inputMessages,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${JSON.stringify(data)}`);
  const text = extractOpenAIText(data);
  if (!text) throw new Error("OpenAI retornou resposta vazia");
  return { text, responseId: data?.id ?? null };
}

async function maybeRunAgent(input: {
  tenantId: string;
  integrationId: string;
  accountId: string;
  provider: Provider;
  externalContactId: string;
  contact: any;
  conversation: any;
  body: string;
  messageType: string;
}) {
  if (input.contact.opted_out_at || input.conversation.human_handoff || input.conversation.ai_enabled === false) return;

  const agentResult = await supabase.from("erj_ai_agents").select("*").eq("tenant_id", input.tenantId).maybeSingle();
  if (agentResult.error) throw agentResult.error;
  const agent = agentResult.data;
  if (!agent?.enabled) return;

  const bodyLower = input.body.toLocaleLowerCase("pt-BR");
  const handoff = (agent.handoff_keywords ?? []).some((word: string) => bodyLower.includes(String(word).toLocaleLowerCase("pt-BR")));

  if (handoff) {
    await supabase.from("erj_conversations").update({ human_handoff: true, status: "human" }).eq("id", input.conversation.id);
    await createTask(input.tenantId, input.contact.id, "Cliente solicitou atendimento humano", "high");
    return;
  }

  if (input.messageType !== "text" || !input.body.trim()) {
    await createTask(input.tenantId, input.contact.id, `Mensagem ${input.messageType} aguardando atendimento`, "normal");
    return;
  }

  let generated: { text: string; responseId: string | null };
  try {
    generated = await generateAIReply({
      tenantId: input.tenantId,
      conversationId: input.conversation.id,
      contactId: input.contact.id,
      agent,
    });
    await touchTenantIntegration(input.tenantId, "openai", "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await touchTenantIntegration(input.tenantId, "openai", "error", message.slice(0, 1800));
    await createTask(input.tenantId, input.contact.id, "Agente IA indisponível: atendimento humano necessário", "high");
    return;
  }

  try {
    const sent = input.provider === "whatsapp"
      ? await sendWhatsAppText(input.accountId, input.externalContactId, generated.text)
      : await sendInstagramText(input.accountId, input.externalContactId, generated.text);

    const now = new Date().toISOString();
    const saved = await supabase.from("erj_messages").insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversation.id,
      direction: "outbound",
      sender_type: "ai",
      provider_message_id: sent.messageId,
      body: generated.text,
      message_type: "text",
      status: "sent",
      metadata: { openai_response_id: generated.responseId },
    });
    if (saved.error && saved.error.code !== "23505") throw saved.error;

    await supabase
      .from("erj_conversations")
      .update({
        status: "ai",
        last_message_at: now,
        last_ai_at: now,
        last_ai_response_id: generated.responseId,
      })
      .eq("id", input.conversation.id);

    await touchIntegration(input.integrationId, "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await touchIntegration(input.integrationId, "error", message.slice(0, 1800));
    await createTask(input.tenantId, input.contact.id, `Falha no envio ${input.provider}: atendimento humano necessário`, "high");
  }
}

async function processInbound(input: {
  provider: Provider;
  accountId: string;
  externalEventId: string;
  externalContactId: string;
  displayName?: string | null;
  username?: string | null;
  messageType: string;
  body: string;
  timestamp: string;
  raw: unknown;
}) {
  const integration = await resolveIntegration(input.provider, input.accountId);
  const event = await logWebhookEvent({
    tenantId: integration?.tenant_id ?? null,
    provider: input.provider,
    externalEventId: input.externalEventId,
    externalAccountId: input.accountId,
    eventType: `message.${input.messageType}`,
    payload: input.raw,
  });

  if (event.duplicate) return;
  if (!integration) {
    await finishWebhookEvent(event.id, "ignored", "Nenhuma integração Errejota vinculada a esta conta Meta");
    return;
  }

  try {
    const contact = await findOrCreateContact({
      tenantId: integration.tenant_id,
      provider: input.provider,
      externalContactId: input.externalContactId,
      displayName: input.displayName,
      username: input.username,
      at: input.timestamp,
    });

    const conversation = await findOrCreateConversation(
      integration.tenant_id,
      contact.id,
      input.provider,
      input.timestamp,
    );

    const inserted = await supabase.from("erj_messages").insert({
      tenant_id: integration.tenant_id,
      conversation_id: conversation.id,
      direction: "inbound",
      sender_type: "customer",
      provider_message_id: input.externalEventId,
      body: input.body || null,
      message_type: input.messageType || "unknown",
      status: "received",
      metadata: { provider: input.provider },
    });

    if (inserted.error?.code === "23505") {
      await finishWebhookEvent(event.id, "processed");
      return;
    }
    if (inserted.error) throw inserted.error;

    await touchIntegration(integration.id, "connected");
    await maybeRunAgent({
      tenantId: integration.tenant_id,
      integrationId: integration.id,
      accountId: input.accountId,
      provider: input.provider,
      externalContactId: input.externalContactId,
      contact,
      conversation,
      body: input.body,
      messageType: input.messageType,
    });

    await finishWebhookEvent(event.id, "processed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishWebhookEvent(event.id, "error", message.slice(0, 1800));
  }
}

async function processWhatsAppStatus(accountId: string, status: any) {
  const externalEventId = `${status?.id ?? crypto.randomUUID()}:${status?.status ?? "unknown"}:${status?.timestamp ?? ""}`;
  const integration = await resolveIntegration("whatsapp", accountId);
  const event = await logWebhookEvent({
    tenantId: integration?.tenant_id ?? null,
    provider: "whatsapp",
    externalEventId,
    externalAccountId: accountId,
    eventType: `status.${status?.status ?? "unknown"}`,
    payload: status,
  });
  if (event.duplicate) return;
  if (!integration) {
    await finishWebhookEvent(event.id, "ignored", "Integração WhatsApp não vinculada");
    return;
  }

  try {
    await supabase
      .from("erj_messages")
      .update({ status: status?.status ?? "unknown" })
      .eq("tenant_id", integration.tenant_id)
      .eq("provider_message_id", status?.id ?? "");
    await touchIntegration(integration.id, "connected");
    await finishWebhookEvent(event.id, "processed");
  } catch (error) {
    await finishWebhookEvent(event.id, "error", error instanceof Error ? error.message : String(error));
  }
}

async function processPayload(payload: any) {
  if (payload?.object === "whatsapp_business_account") {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== "messages") continue;
        const value = change?.value ?? {};
        const accountId = String(value?.metadata?.phone_number_id ?? "");
        if (!accountId) continue;
        const contactMap = new Map<string, string>();
        for (const c of value?.contacts ?? []) {
          if (c?.wa_id) contactMap.set(String(c.wa_id), String(c?.profile?.name ?? ""));
        }

        for (const message of value?.messages ?? []) {
          const externalContactId = String(message?.from ?? "");
          if (!message?.id || !externalContactId) continue;
          const timestamp = message?.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString();
          await processInbound({
            provider: "whatsapp",
            accountId,
            externalEventId: String(message.id),
            externalContactId,
            displayName: contactMap.get(externalContactId) || null,
            messageType: String(message?.type ?? "unknown"),
            body: messageBody("whatsapp", message),
            timestamp,
            raw: message,
          });
        }

        for (const status of value?.statuses ?? []) await processWhatsAppStatus(accountId, status);
      }
    }
    return;
  }

  if (payload?.object === "instagram") {
    for (const entry of payload?.entry ?? []) {
      const accountId = String(entry?.id ?? "");
      if (!accountId) continue;
      for (const item of entry?.messaging ?? []) {
        if (!item?.message || item?.message?.is_echo) continue;
        const externalContactId = String(item?.sender?.id ?? "");
        const messageId = String(item?.message?.mid ?? "");
        if (!externalContactId || !messageId) continue;
        const timestamp = item?.timestamp ? new Date(Number(item.timestamp)).toISOString() : new Date().toISOString();
        await processInbound({
          provider: "instagram",
          accountId,
          externalEventId: messageId,
          externalContactId,
          messageType: item?.message?.text ? "text" : "unknown",
          body: messageBody("instagram", item),
          timestamp,
          raw: item,
        });
      }
    }
  }
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      const configuredToken = env("META_WEBHOOK_VERIFY_TOKEN");
      if (!configuredToken) return new Response("META_WEBHOOK_VERIFY_TOKEN não configurado", { status: 503 });
      if (token !== configuredToken) return new Response("Token inválido", { status: 403 });
      return new Response(challenge ?? "", { status: 200 });
    }

    return json({
      ok: true,
      service: "errejota-meta-webhook",
      version: 2,
      ready: Boolean(env("META_WEBHOOK_VERIFY_TOKEN") && env("META_APP_SECRET")),
      channels: {
        whatsapp: Boolean(env("WHATSAPP_ACCESS_TOKEN")),
        instagram: Boolean(env("INSTAGRAM_ACCESS_TOKEN")),
        openai: Boolean(env("OPENAI_API_KEY")),
      },
    });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const validSignature = await verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"));
  if (!validSignature) return new Response("Assinatura Meta inválida ou META_APP_SECRET ausente", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const job = processPayload(payload);
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(job);
  else await job;

  return json({ received: true });
});
