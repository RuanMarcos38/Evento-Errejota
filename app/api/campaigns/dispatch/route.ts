import { NextRequest, NextResponse } from "next/server";
import { checkMarketingEligibility, OutreachContact } from "@/lib/compliance";
import { sendInstagramText, sendWhatsAppTemplate } from "@/lib/meta";

type DispatchBody = {
  channel: "whatsapp" | "instagram";
  contacts: OutreachContact[];
  dryRun?: boolean;
  whatsapp?: {
    templateName: string;
    languageCode?: string;
    bodyParameters?: Record<string, string[]>;
  };
  instagram?: {
    text: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DispatchBody;
    const dryRun = body.dryRun !== false;

    if (!Array.isArray(body.contacts) || body.contacts.length === 0) {
      return NextResponse.json({ error: "Informe ao menos um contato." }, { status: 400 });
    }

    if (body.contacts.length > 50) {
      return NextResponse.json({ error: "Máximo de 50 contatos por lote. Use uma fila para volumes maiores." }, { status: 400 });
    }

    const eligible = body.contacts.map((contact) => ({
      contact,
      eligibility: checkMarketingEligibility(contact),
    }));

    const blocked = eligible.filter((item) => !item.eligibility.allowed);
    const allowed = eligible.filter((item) => item.eligibility.allowed);

    if (dryRun) {
      return NextResponse.json({
        mode: "dry-run",
        channel: body.channel,
        total: body.contacts.length,
        eligible: allowed.length,
        blocked: blocked.length,
        blockedContacts: blocked.map((item) => ({ id: item.contact.id, reasons: item.eligibility.reasons })),
      });
    }

    const results = [];

    for (const item of allowed) {
      try {
        if (body.channel === "whatsapp") {
          if (!item.contact.phone || !body.whatsapp?.templateName) {
            results.push({ id: item.contact.id, status: "skipped", reason: "Telefone ou template ausente." });
            continue;
          }

          const response = await sendWhatsAppTemplate({
            to: item.contact.phone,
            templateName: body.whatsapp.templateName,
            languageCode: body.whatsapp.languageCode,
            bodyParameters: body.whatsapp.bodyParameters?.[item.contact.id],
          });

          results.push({ id: item.contact.id, status: "sent", provider: response });
          continue;
        }

        if (!item.contact.instagramScopedId || !body.instagram?.text) {
          results.push({ id: item.contact.id, status: "skipped", reason: "Instagram scoped ID ou mensagem ausente." });
          continue;
        }

        const response = await sendInstagramText({
          recipientId: item.contact.instagramScopedId,
          text: body.instagram.text,
        });
        results.push({ id: item.contact.id, status: "sent", provider: response });
      } catch (error) {
        results.push({ id: item.contact.id, status: "error", reason: error instanceof Error ? error.message : "Falha desconhecida" });
      }
    }

    return NextResponse.json({
      mode: "live",
      channel: body.channel,
      attempted: allowed.length,
      blocked: blocked.length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao processar campanha." }, { status: 500 });
  }
}
