import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/components/forms/service-form";
import { ServiceCatalog } from "@/components/services/service-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export default async function Services() {
  const s = await createClient();
  const { data } = await s
    .from("services")
    .select("id,name,category,description,default_periodicity,status")
    .neq("status", "archived")
    .order("name");

  return (
    <>
      <PageHeader
        title="Hizmetler"
        description="Global hizmet kataloğunu yönetin."
      />
      <Card className="mb-6 p-5">
        <ServiceForm />
      </Card>
      <ServiceCatalog services={data || []} />
    </>
  );
}
