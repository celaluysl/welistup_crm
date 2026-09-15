import Link from "next/link";
import {
  ExpenseYearWorkspace,
  type ExpenseDefinition,
  type ExpenseRow,
} from "@/components/expenses/expense-year-workspace";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type Payment = {
  amount: number;
  payment_date: string;
  payment_channel?: string;
  payer_name?: string | null;
  accounts?: unknown;
};
export default async function Expenses({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; type?: string }>;
}) {
  const q = await searchParams,
    now = new Date(),
    parsed = Number(q.year) || now.getFullYear(),
    year = Math.min(2200, Math.max(2000, parsed)),
    selectedMonth = Math.min(12, Math.max(1, Number(q.month) || now.getMonth() + 1));
  const billing = q.type === "uninvoiced" ? "uninvoiced" : "invoiced";
  const s = await createClient();
  await s.rpc("generate_recurring_manual_expenses", {
    p_until: `${year}-12-31`,
  });
  const [vendorResult, definitionResult, manualResult, accountResult] = await Promise.all([
    s
      .from("vendor_accruals")
      .select(
        "id,vendor_assignment_id,month,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,notes,requires_amount_review,vendors(name),projects(name,clients(company_name)),project_services(services(name)),vendor_payments(amount,payment_date,payment_channel,payer_name,accounts(name))",
      )
      .eq("year", year)
      .eq("billing_preference", billing)
      .neq("status", "cancelled")
      .order("month"),
    s
      .from("manual_expense_templates")
      .select(
        "id,name,category,net_amount,vat_rate,currency,billing_preference,due_day,notes,status,is_recurring",
      )
      .eq("billing_preference", billing)
      .order("name"),
    s
      .from("manual_expenses")
      .select(
        "id,template_id,month,name,category,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,notes,manual_expense_payments(amount,payment_date,accounts(name))",
      )
      .eq("year", year)
      .eq("billing_preference", billing)
      .neq("status", "cancelled")
      .order("month"),
    s
      .from("accounts")
      .select("id,name,currency,billing_preference,opening_balance")
      .eq("status", "active")
      .order("name"),
  ]);
  const accountNames = billing === "invoiced"
    ? { source: "Şirket Tahsilat Kasası", target: "Şirket Gider Kasası", label: "Faturalı gider kasası" }
    : { source: "Faturasız Tahsilat Kasası", target: "Faturasız Gider Kasası", label: "Faturasız gider kasası" };
  const targetAccount = (accountResult.data || []).find((account) => account.name === accountNames.target);
  const vendorRows: ExpenseRow[] = (vendorResult.data || []).map((r) => {
    const project = rel(r.projects) as { name?: string; clients?: unknown } | null;
    const payments = (r.vendor_payments as Payment[] | null) || [];
    return {
      id: r.id,
      source: "vendor" as const,
      groupKey: `vendor:${rel(r.vendors)?.name || r.id}:${r.currency}:${r.billing_preference}`,
      month: r.month,
      name: rel(r.vendors)?.name || "Tedarikçi",
      category:
        [
          project?.name,
          rel(r.project_services)?.services
            ? rel(rel(r.project_services)?.services)?.name
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Tedarikçi hakedişi",
      net: Number(r.net_amount),
      vatRate: Number(r.vat_rate),
      vat: Number(r.vat_amount),
      total: Number(r.amount),
      paid: payments.reduce((a, p) => a + Number(p.amount), 0),
      currency: r.currency,
      billing: r.billing_preference,
      dueDate: r.due_date,
      notes: r.notes,
      requiresReview: r.requires_amount_review,
      payerName: rel(project?.clients)?.company_name || project?.name || "Müşteri",
      directPaid: payments.filter((p) => p.payment_channel === "client_direct").reduce((a, p) => a + Number(p.amount), 0),
      payments: payments.map((payment) => ({
        amount: Number(payment.amount),
        paymentDate: payment.payment_date,
        accountName: rel(payment.accounts)?.name || null,
        channel: payment.payment_channel,
        payerName: payment.payer_name,
      })),
    };
  });
  const aggregatedVendors = [...vendorRows.reduce((map, row) => {
    const key = `${row.groupKey}:${row.month}`;
    const current = map.get(key);
    if (!current) map.set(key, { ...row, category: "Aylık toplu tedarikçi hakedişi", items: [row] });
    else {
      current.net += row.net; current.vat += row.vat; current.total += row.total;
      current.paid += row.paid; current.directPaid = (current.directPaid || 0) + (row.directPaid || 0);
      current.requiresReview ||= row.requiresReview; current.items!.push(row);
      current.payments.push(...row.payments);
    }
    return map;
  }, new Map<string, ExpenseRow>()).values()];
  const rows: ExpenseRow[] = [
    ...aggregatedVendors,
    ...(manualResult.data || []).map((r) => ({
      id: r.id,
      source: "manual" as const,
      templateId: r.template_id,
      groupKey: r.template_id
        ? `manual-template:${r.template_id}`
        : `manual:${r.name}:${r.category}`,
      month: r.month,
      name: r.name,
      category: r.category,
      net: Number(r.net_amount),
      vatRate: Number(r.vat_rate),
      vat: Number(r.vat_amount),
      total: Number(r.amount),
      paid:
        (r.manual_expense_payments as Payment[] | null)?.reduce(
          (a, p) => a + Number(p.amount),
          0,
        ) || 0,
      currency: r.currency,
      billing: r.billing_preference,
      dueDate: r.due_date,
      notes: r.notes,
      requiresReview: false,
      payments: ((r.manual_expense_payments as Payment[] | null) || []).map((payment) => ({
        amount: Number(payment.amount),
        paymentDate: payment.payment_date,
        accountName: rel(payment.accounts)?.name || null,
      })),
    })),
  ];
  const systemCashLabels = ["faturalı kasa", "faturasız kasa", "faturalı gider kasası", "faturasız gider kasası"];
  const definitions: ExpenseDefinition[] = (definitionResult.data || []).filter(
    (definition) => !systemCashLabels.includes(String(definition.name).trim().toLocaleLowerCase("tr-TR")),
  ).map(
    (definition) => ({
      id: definition.id,
      name: definition.name,
      category: definition.category,
      net: Number(definition.net_amount),
      vatRate: Number(definition.vat_rate),
      currency: definition.currency,
      billing: definition.billing_preference,
      dueDay: definition.due_day,
      notes: definition.notes,
      status: definition.status,
      isRecurring: definition.is_recurring,
    }),
  );
  const error =
    vendorResult.error ||
    manualResult.error ||
    definitionResult.error ||
    accountResult.error;
  return (
    <>
      <PageHeader
        title={
          billing === "invoiced" ? "Faturalı Giderler" : "Faturasız Giderler"
        }
        description={
          billing === "invoiced"
            ? "KDV dâhil giderleri, tedarikçi hakedişlerini ve kasa çıkışlarını ay ay takip edin."
            : "KDV uygulanmayan giderleri ve faturasız gider kasasından yapılan ödemeleri ay ay takip edin."
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Link
            href={`/expenses?year=${year - 1}&month=${selectedMonth}&type=${billing}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            ← {year - 1}
          </Link>
          <span className="rounded-lg bg-red-50 px-5 py-2 font-bold text-[#CD0B16]">
            {year}
          </span>
          <Link
            href={`/expenses?year=${year + 1}&month=${selectedMonth}&type=${billing}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            {year + 1} →
          </Link>
          <form className="flex items-center gap-2">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="type" value={billing} />
            <select
              name="month"
              defaultValue={selectedMonth}
              className="h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-slate-700"
              aria-label="Özet ayı"
            >
              {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((monthName, index) => (
                <option key={monthName} value={index + 1}>{monthName}</option>
              ))}
            </select>
            <button className="h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Ayı göster
            </button>
          </form>
        </div>
        <div className="flex rounded-lg border bg-white p-1">
          <Link
            href={`/expenses?year=${year}&month=${selectedMonth}&type=invoiced`}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${billing === "invoiced" ? "bg-[#CD0B16] text-white" : "text-slate-500"}`}
          >
            Faturalı giderler
          </Link>
          <Link
            href={`/expenses?year=${year}&month=${selectedMonth}&type=uninvoiced`}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${billing === "uninvoiced" ? "bg-[#CD0B16] text-white" : "text-slate-500"}`}
          >
            Faturasız giderler
          </Link>
        </div>
      </div>
      {error ? (
        <Card className="border-red-200 bg-red-50 p-8 text-center text-red-700">
          Gider kayıtları yüklenemedi: {error.message}
        </Card>
      ) : (
        <ExpenseYearWorkspace
          rows={rows}
          definitions={definitions}
          accounts={accountResult.data || []}
          cashSummary={{
            label: accountNames.label,
            monthLabel: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][selectedMonth - 1],
            fixedAmount: Number(targetAccount?.opening_balance || 0),
            spent: rows
              .filter((row) => row.month === selectedMonth)
              .reduce((total, row) => total + row.paid - (row.directPaid || 0), 0),
            remaining: Number(targetAccount?.opening_balance || 0) - rows
              .filter((row) => row.month === selectedMonth)
              .reduce((total, row) => total + row.paid - (row.directPaid || 0), 0),
          }}
          year={year}
          billing={billing}
        />
      )}
    </>
  );
}
function rel(v: unknown) {
  return (Array.isArray(v) ? v[0] : v) as {
    name?: string;
    company_name?: string;
    clients?: unknown;
    services?: unknown;
  } | null;
}
