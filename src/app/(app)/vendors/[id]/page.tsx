import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorAssignmentForm } from "@/components/forms/vendor-assignment-form";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
export default async function VendorDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const [{ data: v }, { data: projectServices }] = await Promise.all([
    s
      .from("vendors")
      .select(
        "*,vendor_assignments(id,start_date,end_date,default_amount,currency,status,payment_model,billing_preference,vat_rate,payment_day,project_services(id,projects(name,clients(company_name)),services(name)))",
      )
      .eq("id", id)
      .single(),
    s
      .from("project_services")
      .select("id,currency,projects(name,clients(company_name)),services(name)")
      .eq("status", "active"),
  ]);
  if (!v) notFound();
  const options = (projectServices || []).map((x) => ({
    id: x.id,
    currency: x.currency,
    label: `${rel(x.projects)?.company_name} · ${rel(x.projects)?.name} · ${rel(x.services)?.name}`,
  }));
  return (
    <>
      <div className="mb-6">
        <div className="text-sm text-slate-500">Tedarikçiler</div>
        <h1 className="mt-1 text-2xl font-bold">{v.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {v.email || "—"} · {v.phone || "—"}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="border-b px-5 py-4 font-semibold">
            Proje hizmeti atamaları
          </div>
          <div className="divide-y">
            {v.vendor_assignments?.map(
              (a: {
                id: string;
                start_date: string;
                end_date: string | null;
                default_amount: number;
                currency: string;
                payment_model: string;
                billing_preference: string;
                vat_rate: number;
                payment_day: number;
                project_services: unknown;
              }) => {
                const ps = rel(a.project_services) as {
                  projects?: unknown;
                  services?: unknown;
                } | null;
                return (
                  <div key={a.id} className="px-5 py-4">
                    <div className="font-medium">
                      {rel(ps?.projects)?.company_name} ·{" "}
                      {rel(ps?.projects)?.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {rel(ps?.services)?.name} · {modelLabels[a.payment_model]}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {a.payment_model === "monthly_variable"
                          ? "Tutar ay sonunda girilecek"
                          : `${formatMoney(a.default_amount, a.currency)} net`}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {a.billing_preference === "invoiced"
                          ? `Faturalı · KDV %${a.vat_rate}`
                          : "Faturasız"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        Ayın {a.payment_day}. günü
                      </span>
                    </div>
                  </div>
                );
              },
            )}
            {!v.vendor_assignments?.length && (
              <div className="p-8 text-center text-sm text-slate-400">
                Henüz atama yok.
              </div>
            )}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Proje hizmetine ata</h2>
          <VendorAssignmentForm vendorId={id} services={options} />
        </Card>
      </div>
    </>
  );
}
const modelLabels: Record<string, string> = {
  monthly_fixed: "Aylık sabit",
  monthly_variable: "Aylık değişken",
  one_time: "Tek seferlik",
};
function rel(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    company_name?: string;
    name?: string;
  } | null;
}
