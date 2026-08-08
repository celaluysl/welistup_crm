import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

const labels: Record<string, string> = {
  pending: "Bekliyor",
  partial: "Kısmi",
  paid: "Ödendi",
  overdue: "Gecikmiş",
};
type Payment = { amount: number };

export default async function Collections({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("receivables")
    .select(
      "id,total_amount,currency,due_date,status,clients(company_name),projects(name),payments(amount)",
    )
    .order("due_date", { ascending: true, nullsFirst: false });
  if (["pending", "partial", "paid"].includes(status || ""))
    query = query.eq("status", status as "pending" | "partial" | "paid");
  const { data, error } = await query;
  return (
    <>
      <PageHeader
        title="Tahsilat"
        description="Tahakkuk dönemi ile gerçek ödeme tarihini ayrı izleyen alacak ve parçalı ödeme ekranı."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["", "Tümü"],
          ["pending", "Bekleyen"],
          ["partial", "Kısmi"],
          ["paid", "Ödenen"],
        ].map(([v, l]) => (
          <Link
            key={v}
            href={v ? `/collections?status=${v}` : "/collections"}
            className={`rounded-lg border px-3 py-2 text-sm ${status === v || (!status && !v) ? "border-[#CD0B16] bg-red-50 text-[#CD0B16]" : "bg-white"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Müşteri / Proje",
                  "Toplam",
                  "Tahsil edilen",
                  "Kalan",
                  "Vade",
                  "Durum",
                ].map((x) => (
                  <th key={x} className="px-5 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((row) => {
                const paid =
                  (row.payments as Payment[] | null)?.reduce(
                    (sum, p) => sum + Number(p.amount),
                    0,
                  ) || 0;
                const overdue =
                  row.status !== "paid" &&
                  row.due_date &&
                  row.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/collections/${row.id}`}
                        className="font-semibold hover:text-[#CD0B16]"
                      >
                        {relation(row.clients)?.company_name}
                      </Link>
                      <div className="text-xs text-slate-400">
                        {relation(row.projects)?.name}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {formatMoney(row.total_amount, row.currency)}
                    </td>
                    <td className="px-5 py-4 text-emerald-700">
                      {formatMoney(paid, row.currency)}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatMoney(
                        Number(row.total_amount) - paid,
                        row.currency,
                      )}
                    </td>
                    <td className="px-5 py-4">{row.due_date || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${overdue ? "bg-red-50 text-[#CD0B16]" : "bg-slate-100"}`}
                      >
                        {overdue ? "Gecikmiş" : labels[row.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(!data?.length || error) && (
          <div className="p-10 text-center text-sm text-slate-500">
            {error
              ? "Tahsilat kayıtları yüklenemedi."
              : "Henüz alacak kaydı yok."}
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
  } | null;
}
