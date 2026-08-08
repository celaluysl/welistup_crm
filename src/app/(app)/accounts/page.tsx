import { createClient } from "@/lib/supabase/server";
import { AccountForm, TransferForm } from "@/components/forms/account-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
const labels: Record<string, string> = {
  bank: "Banka",
  cash: "Nakit",
  virtual: "Sanal",
  credit_card: "Kredi kartı",
  other: "Diğer",
};
export default async function Accounts() {
  const s = await createClient();
  const [{ data: accounts }, { data: balances }] = await Promise.all([
    s
      .from("accounts")
      .select(
        "id,name,account_type,currency,billing_preference,opening_balance,status",
      )
      .neq("status", "archived")
      .order("name"),
    s.rpc("account_balances"),
  ]);
  const map = new Map(
    ((balances || []) as { account_id: string; balance: number }[]).map((x) => [
      x.account_id,
      x.balance,
    ]),
  );
  return (
    <>
      <PageHeader
        title="Kasalar ve Hesaplar"
        description="Bakiyeler hareket defterinden hesaplanır; transferler gelir veya gider sayılmaz."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accounts?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="text-xs text-slate-500">
              {labels[a.account_type]} ·{" "}
              {a.billing_preference === "invoiced" ? "Resmi" : "Faturasız"}
            </div>
            <h2 className="mt-1 font-semibold">{a.name}</h2>
            <div className="mt-4 text-xl font-bold">
              {formatMoney(map.get(a.id) ?? a.opening_balance, a.currency)}
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Yeni kasa</h2>
          <AccountForm />
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Kasalar arası transfer</h2>
          <TransferForm accounts={accounts || []} />
        </Card>
      </div>
    </>
  );
}
