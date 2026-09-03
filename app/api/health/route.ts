import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "evento-errejota",
    timestamp: new Date().toISOString(),
    integrations: {
      whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      instagram: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID),
      ai: Boolean(process.env.OPENAI_API_KEY),
      database: Boolean(process.env.DATABASE_URL),
    },
  });
}
