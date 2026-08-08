import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DocumentRowActions } from "@/components/forms/document-row-actions";
import { formatMoney } from "@/lib/utils";

export default async function Proformas() {
  const s = await createClient();
  const { data, error } = await s.from("proformas").select("id,proforma_number,issue_date,valid_until,currency,status,grand_total,customer_name,clients(company_name)").order("created_at", { ascending: false });
  return <>
    <PageHeader title="Proformalar" description="Mali belge niteliği taşımayan ödeme talep belgeleri." action={{ label: "Yeni proforma", href: "/proformas/new" }} />
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_150px_150px_100px] border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500">
        <div>Proforma</div><div>Müşteri</div><div>Tarih</div><div>Toplam</div><div className="text-right">İşlemler</div>
      </div>
      <div className="divide-y">{data?.map((p) => <div key={p.id} className="grid grid-cols-[1fr_1fr_150px_150px_100px] items-center gap-2 px-5 py-3 hover:bg-slate-50">
        <Link href={`/proformas/${p.id}`} className="font-semibold hover:text-[#CD0B16]">{p.proforma_number}</Link>
        <div>{p.customer_name || (p.clients as unknown as { company_name: string } | null)?.company_name || "—"}</div>
        <div className="text-sm text-slate-500">{p.issue_date}</div>
        <div className="font-medium">{formatMoney(p.grand_total, p.currency)}</div>
        <DocumentRowActions id={p.id} type="proforma" />
      </div>)}</div>
      {(!data?.length || error) && <div className="p-10 text-center text-sm text-slate-500">{error ? "Proformalar yüklenemedi." : "Henüz proforma yok."}</div>}
    </Card>
  </>;
}
