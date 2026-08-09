import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { goToPeriod } from "@/lib/actions/finance";
import { MonthlyPeriodForm } from "@/components/forms/monthly-period-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { VariablePeriodEditor } from "@/components/operations/variable-period-editor";

const invoiceLabels: Record<string, string> = {
  waiting: "Bekliyor",
  issued: "Kesildi",
  payment_pending: "Ödeme bekliyor",
  partial: "Kısmi",
  paid: "Ödendi",
};
const collectionLabels: Record<string, string> = {
  pending: "Bekliyor",
  partial: "Kısmi",
  paid: "Ödendi",
  overdue: "Gecikmiş",
};
const reportLabels: Record<string, string> = {
  planned: "Planlandı",
  preparing: "Hazırlanıyor",
  ready: "Hazır",
  sent: "Gönderildi",
  approved: "Onaylandı",
};

export default async function MonthlyOperations({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const raw = await params;
  const year = Number(raw.year),
    month = Number(raw.month);
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2200 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_periods")
    .select(
      "id,year,month,net_amount,vat_rate,gross_amount,currency,notes,invoice_status,collection_status,report_status,due_date,clients(company_name),projects(name),services(name),project_services(periodicity)",
    )
    .eq("year", year)
    .eq("month", month)
    .order("created_at");
  const title = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return (
    <>
      <PageHeader
        title={`Ödeme Kontrolü · ${title}`}
        description="Bulunduğunuz ayın müşteri ödemelerini, faturalama ve tahsilat durumlarıyla kontrol edin."
      />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form action={goToPeriod} className="flex items-end gap-2">
            <label className="grid gap-1 text-xs text-slate-500">
              Yıl
              <input
                name="year"
                type="number"
                defaultValue={year}
                className="h-10 w-24 rounded-lg border px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Ay
              <select
                name="month"
                defaultValue={month}
                className="h-10 rounded-lg border px-3 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(
                      new Date(2026, i, 1),
                    )}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-10 rounded-lg border px-4 text-sm font-semibold">
              Döneme git
            </button>
          </form>
          <MonthlyPeriodForm year={year} month={month} />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Müşteri",
                  "Proje",
                  "Hizmet",
                  "Satış",
                  "Fatura",
                  "Tahsilat",
                  "Rapor",
                  "Vade",
                ].map((x) => (
                  <th key={x} className="px-4 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((row) => (
                <tr key={row.id} className={`transition-colors ${row.collection_status === "paid" ? "bg-emerald-50/60 hover:bg-emerald-50" : row.collection_status === "partial" ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-slate-50"}`}>
                  <td className="px-4 py-4 font-semibold">
                    {relation(row.clients)?.company_name}
                  </td>
                  <td className="px-4 py-4">{relation(row.projects)?.name}</td>
                  <td className="px-4 py-4">{relation(row.services)?.name}</td>
                  <td className="px-4 py-4 font-medium">
                    {formatMoney(row.gross_amount, row.currency)}
                    {relation(row.project_services)?.periodicity === "variable_monthly" && (
                      <VariablePeriodEditor
                        id={row.id}
                        amount={Number(row.net_amount)}
                        notes={row.notes}
                        currency={row.currency}
                      />
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Badge>{invoiceLabels[row.invoice_status]}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={row.collection_status === "paid" ? "success" : row.collection_status === "partial" ? "warning" : row.collection_status === "overdue" ? "danger" : "danger"}>
                      <Link href="/collections">
                        {collectionLabels[row.collection_status]}
                      </Link>
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge>{reportLabels[row.report_status]}</Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-500">
                    {row.due_date || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!data?.length || error) && (
          <div className="p-10 text-center text-sm text-slate-500">
            {error
              ? "Ödeme kontrolü kayıtları yüklenemedi."
              : "Bu dönem için kayıt yok. Aylık kayıtları oluşturabilirsiniz."}
          </div>
        )}
      </Card>
    </>
  );
}

function relation(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    company_name?: string;
    name?: string;
    periodicity?: string;
  } | null;
}
function Badge({
  children,
  tone = "neutral",
}: React.PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "danger" }>) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    warning: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    danger: "bg-red-50 text-[#CD0B16] ring-1 ring-red-100",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
