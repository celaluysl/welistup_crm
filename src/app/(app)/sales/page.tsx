import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SalesWorkspace } from "@/components/sales/sales-workspace";

export default async function Sales() {
  const s = await createClient();
  const [{ data: leads }, { data: activities }, { data: leadServices }, { data: services }, { data: profiles }] =
    await Promise.all([
      s
        .from("leads")
        .select("id,company_name,contact_name,phone,email,source,estimated_budget,currency,sales_owner_id,next_contact_date,description,status,converted_client_id,created_at,owner:profiles!leads_sales_owner_id_fkey(first_name,last_name,email)")
        .order("created_at"),
      s
        .from("lead_activities")
        .select("id,lead_id,activity_type,note,activity_at,creator:profiles!lead_activities_created_by_fkey(first_name,last_name,email)")
        .order("activity_at", { ascending: false }),
      s.from("lead_services").select("lead_id,service_id,services(name)"),
      s.from("services").select("id,name").eq("status", "active").order("name"),
      s
        .from("profiles")
        .select("id,first_name,last_name,email")
        .eq("status", "active")
        .order("first_name"),
    ]);

  const enriched = (leads || []).map((lead) => ({
    ...lead,
    activities: (activities || []).filter((item) => item.lead_id === lead.id),
    services: (leadServices || [])
      .filter((item) => item.lead_id === lead.id)
      .map((item) => ({
        id: item.service_id,
        name: (item.services as unknown as { name: string } | null)?.name || "Hizmet",
      })),
  }));

  return (
    <>
      <PageHeader
        title="Satış Pipeline"
        description="Leadleri filtreleyin, hızlıca inceleyin ve aşamalar arasında sürükleyin."
      />
      <SalesWorkspace
        key={enriched.map((lead) => `${lead.id}:${lead.status}:${lead.activities.length}`).join("|")}
        initialLeads={enriched as never[]}
        services={services || []}
        profiles={profiles || []}
      />
    </>
  );
}
