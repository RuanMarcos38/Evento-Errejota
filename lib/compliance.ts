export type ConsentStatus = "opted_in" | "unknown" | "opted_out";

export type OutreachContact = {
  id: string;
  name: string;
  phone?: string;
  instagramScopedId?: string;
  consentStatus: ConsentStatus;
  consentSource?: string;
  lastMarketingAt?: string;
  marketingMessagesLast7Days?: number;
};

export type EligibilityResult = {
  allowed: boolean;
  reasons: string[];
};

const MAX_MARKETING_MESSAGES_7_DAYS = 3;
const MIN_HOURS_BETWEEN_MARKETING_MESSAGES = 20;

export function checkMarketingEligibility(contact: OutreachContact): EligibilityResult {
  const reasons: string[] = [];

  if (contact.consentStatus !== "opted_in") {
    reasons.push(contact.consentStatus === "opted_out" ? "Contato solicitou descadastro." : "Consentimento de marketing não registrado.");
  }

  if ((contact.marketingMessagesLast7Days ?? 0) >= MAX_MARKETING_MESSAGES_7_DAYS) {
    reasons.push("Limite interno de frequência atingido nos últimos 7 dias.");
  }

  if (contact.lastMarketingAt) {
    const elapsed = Date.now() - new Date(contact.lastMarketingAt).getTime();
    const hours = elapsed / 3_600_000;
    if (hours < MIN_HOURS_BETWEEN_MARKETING_MESSAGES) reasons.push("Contato acionado recentemente; aguarde a janela interna de frequência.");
  }

  return { allowed: reasons.length === 0, reasons };
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
