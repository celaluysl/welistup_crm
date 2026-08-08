import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/forms/project-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
export default async function NewProject({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id } = await searchParams;
  const s = await createClient();
  const [{ data: clients }, { data: services }, { data: specialists }] =
    await Promise.all([
      s
        .from("clients")
        .select("id,company_name")
        .eq("status", "active")
        .order("company_name"),
      s
        .from("services")
        .select("id,name,default_periodicity")
        .eq("status", "active")
        .order("name"),
      s
        .from("profiles")
        .select("id,first_name,last_name,email")
        .eq("status", "active")
        .order("first_name"),
    ]);
  return (
    <>
      <PageHeader
        title="Yeni proje"
        description="Proje ve aldığı hizmetleri tek işlemde oluşturun."
      />
      <Card className="w-full p-6 lg:p-8">
        <ProjectForm
          clients={clients || []}
          services={services || []}
          specialists={specialists || []}
          initialClientId={client_id}
        />
      </Card>
    </>
  );
}
