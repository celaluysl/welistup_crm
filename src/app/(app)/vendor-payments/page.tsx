import { createClient } from "@/lib/supabase/server";
import {
  GenerateVendorAccrualsForm,
  VendorAccrualAmountForm,
  VendorPaymentForm,
} from "@/components/forms/vendor-accrual-forms";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

type Payment = { amount: number };
const statusLabels: Record<string, string> = {
  pending: "Bekliyor",
  partial: "Kısmi",
  paid: "Ödendi",
  cancelled: "İptal",
};
export default async function VendorPayments({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const q = await searchParams,
    now = new Date(),
    year = Number(q.year) || now.getFullYear(),
    month = Number(q.month) || now.getMonth() + 1;
  const s = await createClient();
  const [{ data: rows, error }, { data: accounts }] = await Promise.all([
    s
      .from("vendor_accruals")
      .select(
        "id,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,requires_amount_review,due_date,status,notes,vendors(name),projects(name,clients(company_name)),project_services(services(name)),vendor_payments(amount)",
      )
      .eq("year", year)
      .eq("month", month)
      .order("due_date"),
    s
      .from("accounts")
      .select("id,name,currency,billing_preference")
      .eq("status", "active")
      .order("name"),
  ]);
  return (
    <>
      <PageHeader
        title="Tedarikçi Hakedişleri"
        description="Hizmet maliyetinin dönemi ile gerçek kasa çıkış tarihini ayrı takip edin."
      />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form className="flex items-end gap-2">
            <label className="grid gap-1 text-xs text-slate-500">
              Yıl
              <input
                name="year"
                type="number"
                defaultValue={year}
                className="h-10 w-24 rounded-lg border px-3"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-500">
              Ay
              <select
                name="month"
                defaultValue={month}
                className="h-10 rounded-lg border px-3"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-10 rounded-lg border px-4 text-sm font-semibold">
              Göster
            </button>
          </form>
          <GenerateVendorAccrualsForm year={year} month={month} />
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {rows?.map((r) => {
          const paid =
              (r.vendor_payments as Payment[] | null)?.reduce(
                (sum, p) => sum + Number(p.amount),
                0,
              ) || 0,
            remaining = Math.max(0, Number(r.amount) - paid);
          const project = one(r.projects) as {
            name?: string;
            clients?: unknown;
          } | null;
          const projectService = one(r.project_services) as {
            services?: unknown;
          } | null;
          return (
            <Card key={r.id} className="p-5">
              <div className="flex justify-between gap-4">
                <div>
                  <div className="font-semibold">{one(r.vendors)?.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {one(project?.clients)?.company_name} · {project?.name} ·{" "}
                    {one(projectService?.services)?.name}
                  </div>
                </div>
                <span className="h-fit rounded-full bg-slate-100 px-2 py-1 text-xs">
                  {statusLabels[r.status]}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div>
                  <span className="block text-xs text-slate-400">Hakediş</span>
                  {formatMoney(r.amount, r.currency)}
                </div>
                <div>
                  <span className="block text-xs text-slate-400">Ödenen</span>
                  {formatMoney(paid, r.currency)}
                </div>
                <div>
                  <span className="block text-xs text-slate-400">Kalan</span>
                  <b>{formatMoney(remaining, r.currency)}</b>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {r.billing_preference === "invoiced"
                  ? `Faturalı · ${formatMoney(r.net_amount, r.currency)} net + KDV %${r.vat_rate}`
                  : "Faturasız · KDV uygulanmaz"}
                {r.notes ? ` · ${r.notes}` : ""}
              </div>
              {r.requires_amount_review && (
                <VendorAccrualAmountForm accrualId={r.id} />
              )}
              {remaining > 0 && !r.requires_amount_review && (
                <VendorPaymentForm
                  accrualId={r.id}
                  remaining={remaining}
                  accounts={(accounts || []).filter(
                    (account) =>
                      account.currency === r.currency &&
                      account.billing_preference === r.billing_preference,
                  )}
                />
              )}
            </Card>
          );
        })}
      </div>
      {(!rows?.length || error) && (
        <Card className="p-10 text-center text-sm text-slate-500">
          {error ? "Hakedişler yüklenemedi." : "Bu dönem için hakediş yok."}
        </Card>
      )}
    </>
  );
}
function one(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    name?: string;
    company_name?: string;
  } | null;
}
