import { createClient } from "@/lib/supabase/server";
import { InvoiceTrackingForm } from "@/components/forms/invoice-tracking-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
const labels: Record<string, string> = {
  waiting: "Fatura bekliyor",
  issued: "Fatura kesildi",
  payment_pending: "Ödeme bekleniyor",
  partial: "Kısmi ödeme",
  paid: "Ödendi",
};
export default async function Invoices({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; status?: string }>;
}) {
  const q = await searchParams,
    n = new Date(),
    year = Number(q.year) || n.getFullYear(),
    month = Number(q.month) || n.getMonth() + 1,
    s = await createClient();
  let query = s
    .from("service_periods")
    .select(
      "id,year,month,gross_amount,currency,due_date,invoice_status,clients(company_name),projects(name),services(name),invoices(invoice_number,invoice_date,due_date,status,notes)",
    )
    .eq("year", year)
    .eq("month", month)
    .order("created_at");
  if (
    ["waiting", "issued", "payment_pending", "partial", "paid"].includes(
      q.status || "",
    )
  )
    query = query.eq("invoice_status", q.status as "waiting");
  const { data, error } = await query;
  return (
    <>
      <PageHeader
        title="Fatura Takibi"
        description="Gerçek fatura başka sistemde kesilir; burada numara, tarih, vade ve ödeme durumu izlenir."
      />
      <Card className="mb-6 p-5">
        <form className="flex flex-wrap gap-2">
          <input
            name="year"
            type="number"
            defaultValue={year}
            className="h-10 w-24 rounded-lg border px-3"
          />
          <input
            name="month"
            type="number"
            min="1"
            max="12"
            defaultValue={month}
            className="h-10 w-20 rounded-lg border px-3"
          />
          <select
            name="status"
            defaultValue={q.status || ""}
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">Tüm durumlar</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-lg border px-4 text-sm font-semibold">
            Filtrele
          </button>
        </form>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.map((r) => {
          const invoice = one(r.invoices);
          return (
            <Card key={r.id} className="p-5">
              <div className="flex justify-between gap-4">
                <div>
                  <b>{one(r.clients)?.company_name}</b>
                  <div className="mt-1 text-sm text-slate-500">
                    {one(r.projects)?.name} · {one(r.services)?.name} · {month}/
                    {year}
                  </div>
                </div>
                <div className="text-right">
                  <b>{formatMoney(r.gross_amount, r.currency)}</b>
                  <div className="mt-1 text-xs text-[#CD0B16]">
                    {labels[r.invoice_status]}
                  </div>
                </div>
              </div>
              <InvoiceTrackingForm
                periodId={r.id}
                invoice={invoice}
                defaultDueDate={r.due_date}
              />
            </Card>
          );
        })}
      </div>
      {(!data?.length || error) && (
        <Card className="p-10 text-center text-sm text-slate-500">
          {error
            ? "Fatura kayıtları yüklenemedi."
            : "Bu dönemde hizmet kaydı yok."}
        </Card>
      )}
    </>
  );
}
function one(v: unknown) {
  return (Array.isArray(v) ? v[0] : v) as {
    company_name?: string;
    name?: string;
    invoice_number?: string | null;
    invoice_date?: string | null;
    due_date?: string | null;
    status?: string;
    notes?: string | null;
  } | null;
}
