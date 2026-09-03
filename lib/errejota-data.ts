import { supabase } from "./supabase";

export type ErrejotaSnapshot = {
  tenantId: string;
  activeEvent: {
    id: string;
    name: string;
    capacity: number;
    starts_at: string;
    status: string;
  } | null;
  contacts: number;
  confirmedGuests: number;
  pendingGuests: number;
  openConversations: number;
};

export async function ensureErrejotaTenant(name = "Errejota") {
  const { data, error } = await supabase.rpc("erj_bootstrap_tenant", {
    p_name: name,
  });

  if (error) throw error;
  if (!data) throw new Error("Não foi possível inicializar a empresa Errejota.");

  return data as string;
}

export async function getErrejotaSnapshot(tenantId: string): Promise<ErrejotaSnapshot> {
  const [eventResult, contactsResult, reservationsResult, conversationsResult] =
    await Promise.all([
      supabase
        .from("erj_events")
        .select("id,name,capacity,starts_at,status")
        .eq("tenant_id", tenantId)
        .in("status", ["scheduled", "live", "sold_out"])
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("erj_contacts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("erj_reservations")
        .select("guests,status")
        .eq("tenant_id", tenantId)
        .in("status", ["negotiating", "pending_deposit", "confirmed", "checked_in"]),
      supabase
        .from("erj_conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["open", "ai", "human", "waiting"]),
    ]);

  const firstError = [
    eventResult.error,
    contactsResult.error,
    reservationsResult.error,
    conversationsResult.error,
  ].find(Boolean);

  if (firstError) throw firstError;

  const reservations = reservationsResult.data || [];
  const confirmedGuests = reservations
    .filter((item) => item.status === "confirmed" || item.status === "checked_in")
    .reduce((sum, item) => sum + Number(item.guests || 0), 0);
  const pendingGuests = reservations
    .filter((item) => item.status === "negotiating" || item.status === "pending_deposit")
    .reduce((sum, item) => sum + Number(item.guests || 0), 0);

  return {
    tenantId,
    activeEvent: eventResult.data,
    contacts: contactsResult.count || 0,
    confirmedGuests,
    pendingGuests,
    openConversations: conversationsResult.count || 0,
  };
}
