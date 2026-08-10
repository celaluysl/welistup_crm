import { createClient } from "@/lib/supabase/server";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";
import { PageHeader } from "@/components/ui/page-header";
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
  const balanceMap = new Map(
    ((balances || []) as { account_id: string; balance: number }[]).map(
      (row) => [row.account_id, Number(row.balance)],
    ),
  );
  const rows = (accounts || []).map((account) => ({
    ...account,
    opening_balance: Number(account.opening_balance),
    balance: balanceMap.get(account.id) ?? Number(account.opening_balance),
  }));
  return (
    <>
      <PageHeader
        title="Kasalar ve Hesaplar"
        description="Sabit başlangıç bakiyelerini, para giriş-çıkışlarını ve kasa transferlerini yönetin."
      />
      <AccountsWorkspace accounts={rows} />
    </>
  );
}
