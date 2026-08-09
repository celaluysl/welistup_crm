import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { InvoiceWorkspace, InvoiceWorkspaceRow } from "@/components/invoices/invoice-workspace";
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
      <InvoiceWorkspace rows={(data || []).map((r): InvoiceWorkspaceRow => ({ id: r.id, client: one(r.clients)?.company_name || "—", project: one(r.projects)?.name || "—", service: one(r.services)?.name || "Hizmet", year: r.year, month: r.month, amount: Number(r.gross_amount), currency: r.currency, dueDate: r.due_date, status: r.invoice_status, invoice: one(r.invoices) }))}/>
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
