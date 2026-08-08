import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
type Profit = {
  year: number;
  month: number;
  revenue: number;
  vendor_cost: number;
  payroll_cost: number;
  gross_profit: number;
  estimated_net_profit: number;
};
type Cash = {
  year: number;
  month: number;
  cash_in: number;
  cash_out: number;
  net_change: number;
};
type Project = {
  project_id: string;
  client_name: string;
  project_name: string;
  revenue: number;
  vendor_cost: number;
  gross_profit: number;
  margin_percent: number;
};
export default async function FinancialReports({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const q = await searchParams,
    n = new Date(),
    year = Number(q.year) || n.getFullYear(),
    month = Number(q.month) || n.getMonth() + 1,
    from = `${year}-01-01`,
    to = `${year}-12-31`,
    s = await createClient();
  const [{ data: profit }, { data: cash }, { data: projects }] =
    await Promise.all([
      s.rpc("monthly_profitability", { p_from: from, p_to: to }),
      s.rpc("monthly_cashflow", { p_from: from, p_to: to }),
      s.rpc("project_profitability", { p_year: year, p_month: month }),
    ]);
  return (
    <>
      <PageHeader
        title="Finansal Raporlar"
        description="Kârlılık tahakkuk dönemine, nakit akışı gerçek ödeme tarihine göre ayrı hesaplanır."
      />
      <Card className="mb-6 p-5">
        <form className="flex gap-2">
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
          <button className="h-10 rounded-lg border px-4 text-sm font-semibold">
            Göster
          </button>
        </form>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <ReportTable
          title="Aylık Kârlılık"
          headers={["Dönem", "Gelir", "Vendor", "Maaş", "Net kâr"]}
          rows={((profit as Profit[]) || []).map((x) => [
            `${x.month}/${x.year}`,
            formatMoney(x.revenue),
            formatMoney(x.vendor_cost),
            formatMoney(x.payroll_cost),
            formatMoney(x.estimated_net_profit),
          ])}
        />
        <ReportTable
          title="Aylık Nakit Akışı"
          headers={["Dönem", "Giren", "Çıkan", "Net değişim"]}
          rows={((cash as Cash[]) || []).map((x) => [
            `${x.month}/${x.year}`,
            formatMoney(x.cash_in),
            formatMoney(x.cash_out),
            formatMoney(x.net_change),
          ])}
        />
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b px-5 py-4 font-semibold">
          Proje Kârlılığı · {month}/{year}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Müşteri / Proje",
                  "Gelir",
                  "Vendor maliyeti",
                  "Brüt kâr",
                  "Marj",
                ].map((h) => (
                  <th key={h} className="px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {((projects as Project[]) || []).map((x) => (
                <tr key={x.project_id}>
                  <td className="px-5 py-4">
                    <b>{x.client_name}</b>
                    <div className="text-xs text-slate-400">
                      {x.project_name}
                    </div>
                  </td>
                  <td className="px-5 py-4">{formatMoney(x.revenue)}</td>
                  <td className="px-5 py-4">{formatMoney(x.vendor_cost)}</td>
                  <td className="px-5 py-4 font-semibold">
                    {formatMoney(x.gross_profit)}
                  </td>
                  <td className="px-5 py-4">%{x.margin_percent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4 font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td
                    key={j}
                    className={`px-4 py-3 ${j === r.length - 1 ? "font-semibold" : ""}`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
