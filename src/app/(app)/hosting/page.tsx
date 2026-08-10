import {
  HostingWorkspace,
  type HostingRow,
} from "@/components/hosting/hosting-workspace";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
export default async function Hosting() {
  const s = await createClient();
  await s.rpc("generate_hosting_receivables");
  const [hostingResult, clientResult] = await Promise.all([
    s
      .from("hosting_subscriptions")
      .select("*,clients(company_name)")
      .order("next_payment_date", { ascending: true, nullsFirst: false }),
    s
      .from("clients")
      .select("id,company_name")
      .eq("status", "active")
      .order("company_name"),
  ]);
  const rows: HostingRow[] = (hostingResult.data || []).map((r) => ({
    id: r.id,
    domain: r.domain,
    clientId: r.client_id,
    clientName: rel(r.clients)?.company_name || null,
    accountLabel: r.account_label,
    status: r.status,
    isPaid: r.is_paid,
    installationDate: r.installation_date,
    nextPaymentDate: r.next_payment_date,
    renewalMonths: r.renewal_months,
    fee: Number(r.fee),
    currency: r.currency,
    notes: r.notes,
  }));
  return (
    <>
      <PageHeader
        title="Sunucu Takibi"
        description="CRM müşterisine bağlı olan ve olmayan sunucu yenilemelerini tek listede takip edin."
      />
      {hostingResult.error ? (
        <Card className="p-10 text-center text-red-600">
          Sunucu kayıtları yüklenemedi: {hostingResult.error.message}
        </Card>
      ) : (
        <HostingWorkspace
          rows={rows}
          clients={(clientResult.data || []).map((c) => ({
            id: c.id,
            name: c.company_name,
          }))}
        />
      )}
    </>
  );
}
function rel(v: unknown) {
  return (Array.isArray(v) ? v[0] : v) as { company_name?: string } | null;
}
