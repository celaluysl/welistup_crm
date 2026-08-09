import { createClient } from "@/lib/supabase/server";
import { goToPayrollPeriod } from "@/lib/actions/payroll";
import {
  GeneratePayrollForm,
  PayrollPaymentForm,
} from "@/components/forms/payroll-forms";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
type Payment = { amount: number };
export default async function Payroll({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const q = await searchParams,
    n = new Date(),
    year = Number(q.year) || n.getFullYear(),
    month = Number(q.month) || n.getMonth() + 1,
    s = await createClient();
  const [payrollResult, profileResult, accountResult] = await Promise.all([
    s.from("payroll_periods").select("*").eq("year", year).eq("month", month),
    s.from("profiles").select("id,first_name,last_name"),
    s.from("accounts").select("id,name,currency").eq("status", "active"),
  ]);
  const rows = payrollResult.data || [];
  const profilesById = new Map(
    (profileResult.data || []).map((profile) => [profile.id, profile]),
  );
  const paymentResult = rows.length
    ? await s
        .from("payroll_payments")
        .select("payroll_period_id,amount")
        .in(
          "payroll_period_id",
          rows.map((row) => row.id),
        )
    : { data: [], error: null };
  const paymentsByPayroll = new Map<string, Payment[]>();
  for (const payment of paymentResult.data || []) {
    const current = paymentsByPayroll.get(payment.payroll_period_id) || [];
    current.push({ amount: Number(payment.amount) });
    paymentsByPayroll.set(payment.payroll_period_id, current);
  }
  const loadError =
    payrollResult.error ||
    profileResult.error ||
    accountResult.error ||
    paymentResult.error;
  const payrollSummary = rows.reduce(
    (summary, row) => {
      const paid = (paymentsByPayroll.get(row.id) || []).reduce(
        (total, payment) => total + Number(payment.amount),
        0,
      );
      return {
        total: summary.total + Number(row.net_payable),
        paid: summary.paid + paid,
      };
    },
    { total: 0, paid: 0 },
  );
  return (
    <>
      <PageHeader
        title="Maaşlar"
        description="Çalışan ve ortak maaşları, kâr paylarından bağımsız olarak takip edilir."
      />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form action={goToPayrollPeriod} className="flex gap-2">
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
          <GeneratePayrollForm year={year} month={month} />
        </div>
      </Card>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-slate-500">Toplam maaş</div>
          <div className="mt-2 text-xl font-bold">
            {formatMoney(payrollSummary.total, "TRY")}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Ödenen</div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {formatMoney(payrollSummary.paid, "TRY")}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Kalan</div>
          <div className="mt-2 text-xl font-bold text-[#CD0B16]">
            {formatMoney(
              Math.max(0, payrollSummary.total - payrollSummary.paid),
              "TRY",
            )}
          </div>
        </Card>
      </div>
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-600">
        <span>
          Sabit aylık maaş, ekip arkadaşının profilinden yönetilir. Bu ekran
          yalnızca aylık kayıt ve ödemeleri gösterir.
        </span>
        <Link href="/team" className="font-semibold text-[#CD0B16]">
          Ekip maaşlarını düzenle →
        </Link>
      </Card>
      <div>
        <div className="space-y-4">
          {rows.map((r) => {
            const p = profilesById.get(r.profile_id),
              paid = (paymentsByPayroll.get(r.id) || []).reduce(
                (a, x) => a + Number(x.amount),
                0,
              ),
              remaining = Math.max(0, Number(r.net_payable) - paid);
            return (
              <Card key={r.id} className="p-5">
                <div className="flex justify-between">
                  <div>
                    <b>
                      {p?.first_name} {p?.last_name}
                    </b>
                    <div className="text-sm text-slate-500">
                      {r.employment_type === "partner"
                        ? "Ortak maaşı"
                        : "Personel maaşı"}
                    </div>
                  </div>
                  <b>{formatMoney(r.net_payable, r.currency)}</b>
                </div>
                {remaining > 0 && (
                  <PayrollPaymentForm
                    payrollId={r.id}
                    remaining={remaining}
                    accounts={accountResult.data || []}
                  />
                )}
              </Card>
            );
          })}
          {loadError && (
            <Card className="border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
              Maaş kayıtları yüklenemedi: {loadError.message}
            </Card>
          )}
          {!loadError && !rows.length && (
            <Card className="p-8 text-center text-sm text-slate-400">
              Bu dönem için maaş kaydı yok.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
