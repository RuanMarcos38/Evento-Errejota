import { normalizePhone } from "./compliance";

type WhatsAppTemplateInput = {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
};

type InstagramTextInput = {
  recipientId: string;
  text: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
}

export async function sendWhatsAppTemplate(input: WhatsAppTemplateInput) {
  const token = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

  const components = input.bodyParameters?.length
    ? [{
        type: "body",
        parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
      }]
    : undefined;

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode || "pt_BR" },
        ...(components ? { components } : {}),
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`WhatsApp API: ${JSON.stringify(data)}`);
  return data;
}

export async function sendInstagramText(input: InstagramTextInput) {
  const token = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const accountId = requireEnv("INSTAGRAM_ACCOUNT_ID");
  const version = process.env.INSTAGRAM_GRAPH_VERSION || "v23.0";

  const response = await fetch(`https://graph.instagram.com/${version}/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: input.recipientId },
      message: { text: input.text },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Instagram API: ${JSON.stringify(data)}`);
  return data;
}
