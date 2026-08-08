import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StandaloneProformaForm } from "@/components/forms/standalone-proforma-form";

export default async function EditProforma({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await createClient();
  const [{ data: proforma }, { data: clients }, { data: services }] = await Promise.all([
    s.from("proformas").select("*,proforma_items(*)").eq("id", id).single(),
    s.from("clients").select("id,company_name").eq("status", "active").order("company_name"),
    s.from("services").select("id,name").eq("status", "active").order("name"),
  ]);
  if (!proforma) notFound();
  const serviceRows = services || [];
  const otherService = serviceRows.find((service) => service.name.trim().toLocaleLowerCase("tr-TR") === "diğer");
  const items = [...proforma.proforma_items].sort((a, b) => a.position - b.position).map((item) => ({
    service_id: serviceRows.find((service) => service.name === item.service_name)?.id || otherService?.id || "",
    service_name: item.service_name || "",
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_rate: item.discount_rate,
    vat_rate: item.vat_rate,
  }));
  return <><PageHeader title={`${proforma.proforma_number} · Düzenle`} description="Müşteri, satır, fiyat ve ödeme bilgilerini güncelleyin." /><Card className="p-6"><StandaloneProformaForm clients={clients || []} services={serviceRows} initial={{
    id: proforma.id,
    client_id: proforma.client_id || "",
    customer_name: proforma.customer_name || "",
    customer_legal_name: proforma.customer_legal_name || "",
    customer_tax_office: proforma.customer_tax_office || "",
    customer_tax_number: proforma.customer_tax_number || "",
    customer_address: proforma.customer_address || "",
    customer_phone: proforma.customer_phone || "",
    customer_email: proforma.customer_email || "",
    issue_date: proforma.issue_date,
    valid_until: proforma.valid_until || "",
    currency: proforma.currency,
    bank_details: proforma.bank_details || "",
    description: proforma.description || "",
    payment_terms: proforma.payment_terms || "",
    items,
  }} /></Card></>;
}
