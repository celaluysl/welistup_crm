import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EditClientForm } from "@/components/forms/edit-client-form";
export default async function EditClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const { data } = await s
    .from("clients")
    .select(
      "id,company_name,legal_name,short_name,client_type,contact_name,email,phone,tax_office,tax_number,address,notes",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Müşteriyi düzenle" description={data.company_name} />
      <Card className="w-full p-6 lg:p-8">
        <EditClientForm client={data} />
      </Card>
    </>
  );
}
