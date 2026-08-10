import Link from "next/link";
import { GeneratePayrollForm } from "@/components/forms/payroll-forms";
import {
  PayrollYearWorkspace,
  type PayrollYearRow,
} from "@/components/payroll/payroll-year-workspace";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

type PayrollPayment = {
  id: string;
  payroll_period_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  account_id: string;
};

function safeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export default async function Payroll({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const query = await searchParams;
  const now = new Date();
  const requestedYear = safeNumber(query.year, now.getFullYear());
  const requestedMonth = safeNumber(query.month, now.getMonth() + 1);
  const year = Math.min(2200, Math.max(2000, requestedYear));
  const month = Math.min(12, Math.max(1, requestedMonth));
  const supabase = await createClient();

  const [payrollResult, profileResult, accountResult] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("id,profile_id,month,net_payable,currency,status,employment_type")
      .eq("year", year)
      .order("month"),
    supabase.from("profiles").select("id,first_name,last_name"),
    supabase
      .from("accounts")
      .select("id,name,currency")
      .eq("status", "active")
      .order("name"),
  ]);

  const payrollPeriods = payrollResult.data || [];
  const paymentResult = payrollPeriods.length
    ? await supabase
        .from("payroll_payments")
        .select("id,payroll_period_id,amount,payment_date,notes,account_id")
        .in(
          "payroll_period_id",
          payrollPeriods.map((period) => period.id),
        )
        .order("payment_date", { ascending: false })
    : { data: [] as PayrollPayment[], error: null };

  const profilesById = new Map(
    (profileResult.data || []).map((profile) => [profile.id, profile]),
  );
  const accountsById = new Map(
    (accountResult.data || []).map((account) => [account.id, account]),
  );
  const paymentsByPayroll = new Map<string, PayrollPayment[]>();

  for (const payment of paymentResult.data || []) {
    const current = paymentsByPayroll.get(payment.payroll_period_id) || [];
    current.push(payment);
    paymentsByPayroll.set(payment.payroll_period_id, current);
  }

  const rows: PayrollYearRow[] = payrollPeriods.map((period) => {
    const profile = profilesById.get(period.profile_id);
    const payments = paymentsByPayroll.get(period.id) || [];

    return {
      id: period.id,
      profileId: period.profile_id,
      month: period.month,
      name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        "İsimsiz ekip üyesi",
      employmentType: period.employment_type,
      salary: Number(period.net_payable),
      paid: payments.reduce(
        (total, payment) => total + Number(payment.amount),
        0,
      ),
      currency: period.currency,
      status: period.status,
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentDate: payment.payment_date,
        accountName: accountsById.get(payment.account_id)?.name || null,
        notes: payment.notes,
      })),
    };
  });

  const loadError =
    payrollResult.error ||
    profileResult.error ||
    accountResult.error ||
    paymentResult.error;

  return (
    <>
      <PageHeader
        title="Maaşlar"
        description="Maaşları yıl boyunca ay ay izleyin; ödemeleri ilgili ayın hücresinden yönetin."
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link
              href={`/payroll?year=${year - 1}&month=${month}`}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              ← {year - 1}
            </Link>
            <span className="rounded-lg bg-red-50 px-4 py-2 font-bold text-[#CD0B16]">
              {year}
            </span>
            <Link
              href={`/payroll?year=${year + 1}&month=${month}`}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {year + 1} →
            </Link>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <form className="flex items-end gap-2">
              <input type="hidden" name="year" value={year} />
              <label className="text-sm font-medium text-slate-600">
                Kayıt oluşturulacak ay
                <select
                  name="month"
                  defaultValue={month}
                  className="mt-1 block h-10 rounded-lg border bg-white px-3"
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="h-10 rounded-lg border px-4 text-sm font-semibold hover:bg-slate-50">
                Seç
              </button>
            </form>
            <GeneratePayrollForm year={year} month={month} />
          </div>
        </div>
      </Card>

      <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-600">
        <span>
          Sabit aylık maaş ekip profilinden yönetilir. Hücreye tıklayarak ödeme
          kaydedebilir ve geçmişi görebilirsiniz.
        </span>
        <Link href="/team" className="font-semibold text-[#CD0B16]">
          Ekip maaşlarını düzenle →
        </Link>
      </Card>

      {loadError ? (
        <Card className="border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
          Maaş kayıtları yüklenemedi: {loadError.message}
        </Card>
      ) : (
        <PayrollYearWorkspace
          rows={rows}
          accounts={accountResult.data || []}
          year={year}
        />
      )}
    </>
  );
}
