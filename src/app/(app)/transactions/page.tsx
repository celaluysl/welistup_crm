import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
const labels: Record<string, string> = {
  income: "Gelir",
  expense: "Gider",
  transfer: "Transfer",
};
export default async function Transactions() {
  const s = await createClient();
  const { data, error } = await s
    .from("finance_transactions")
    .select(
      "id,transaction_date,transaction_type,amount,currency,category,description,accounts(name),clients(company_name),vendors(name)",
    )
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(250);
  return (
    <>
      <PageHeader
        title="Finans Hareketleri"
        description="Gelir, gider ve gelir tablosuna dahil edilmeyen kasa transferleri."
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Tarih",
                  "Kasa",
                  "Tür",
                  "Kategori",
                  "İlgili",
                  "Açıklama",
                  "Tutar",
                ].map((x) => (
                  <th key={x} className="px-5 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-4">{t.transaction_date}</td>
                  <td className="px-5 py-4 font-medium">
                    {rel(t.accounts)?.name}
                  </td>
                  <td className="px-5 py-4">{labels[t.transaction_type]}</td>
                  <td className="px-5 py-4">{t.category || "—"}</td>
                  <td className="px-5 py-4">
                    {rel(t.clients)?.company_name ||
                      rel(t.vendors)?.name ||
                      "—"}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {t.description || "—"}
                  </td>
                  <td
                    className={`px-5 py-4 font-semibold ${Number(t.amount) > 0 ? "text-emerald-700" : "text-[#CD0B16]"}`}
                  >
                    {formatMoney(t.amount, t.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!data?.length || error) && (
          <div className="p-10 text-center text-sm text-slate-500">
            {error ? "Hareketler yüklenemedi." : "Henüz finans hareketi yok."}
          </div>
        )}
      </Card>
    </>
  );
}
function rel(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    name?: string;
    company_name?: string;
  } | null;
}
