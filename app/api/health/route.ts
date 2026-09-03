import { NextResponse } from "next/server";

export async function GET() {
  const supabaseConfigured = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iqrnytsgwaiegddfxfjs.supabase.co") &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "configured-public-key"),
  );

  return NextResponse.json({
    ok: true,
    service: "evento-errejota",
    timestamp: new Date().toISOString(),
    integrations: {
      supabase: supabaseConfigured,
      whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      instagram: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID),
      ai: Boolean(process.env.OPENAI_API_KEY),
      databaseWorker: Boolean(process.env.DATABASE_URL),
    },
  });
}
