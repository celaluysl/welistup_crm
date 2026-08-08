import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EditProjectForm } from "@/components/forms/edit-project-form";
export default async function EditProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const [
    { data: project },
    { data: clients },
    { data: services },
    { data: specialists },
  ] = await Promise.all([
    s
      .from("projects")
      .select(
        "id,client_id,name,domain,description,start_date,billing_preference,is_white_label,project_services(id,service_id,periodicity,currency,payment_term_days,notes,status,services(name),project_service_members(profile_id),project_service_prices(net_price,vat_rate,currency,effective_from,effective_to))",
      )
      .eq("id", id)
      .single(),
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
  if (!project) notFound();
  return (
    <>
      <PageHeader title="Projeyi düzenle" description={project.name} />
      <Card className="w-full p-6 lg:p-8">
        <EditProjectForm
          project={project}
          clients={clients || []}
          services={services || []}
          specialists={specialists || []}
        />
      </Card>
    </>
  );
}
