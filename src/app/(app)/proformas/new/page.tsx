import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StandaloneProformaForm } from "@/components/forms/standalone-proforma-form";

export default async function NewProforma() {
  const s = await createClient();
  const [{ data: clients }, { data: services }] = await Promise.all([
    s.from("clients").select("id,company_name").eq("status", "active").order("company_name"),
    s.from("services").select("id,name").eq("status", "active").order("name"),
  ]);
  return <><PageHeader title="Yeni proforma" description="Teklif oluşturmadan doğrudan müşteriye proforma hazırlayın." /><Card className="p-6"><StandaloneProformaForm clients={clients || []} services={services || []} /></Card></>;
}
