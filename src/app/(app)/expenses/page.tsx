import Link from "next/link";
import {
  ExpenseYearWorkspace,
  type ExpenseRow,
} from "@/components/expenses/expense-year-workspace";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type Payment = { amount: number };
export default async function Expenses({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; type?: string }>;
}) {
  const q = await searchParams,
    now = new Date(),
    parsed = Number(q.year) || now.getFullYear(),
    year = Math.min(2200, Math.max(2000, parsed));
  const billing = q.type === "uninvoiced" ? "uninvoiced" : "invoiced";
  const s = await createClient();
  const [vendorResult, manualResult, accountResult] = await Promise.all([
    s
      .from("vendor_accruals")
      .select(
        "id,vendor_assignment_id,month,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,notes,requires_amount_review,vendors(name),projects(name),project_services(services(name)),vendor_payments(amount)",
      )
      .eq("year", year)
      .eq("billing_preference", billing)
      .neq("status", "cancelled")
      .order("month"),
    s
      .from("manual_expenses")
      .select(
        "id,month,name,category,net_amount,vat_rate,vat_amount,amount,currency,billing_preference,due_date,notes,manual_expense_payments(amount)",
      )
      .eq("year", year)
      .eq("billing_preference", billing)
      .neq("status", "cancelled")
      .order("month"),
    s
      .from("accounts")
      .select("id,name,currency,billing_preference")
      .eq("status", "active")
      .order("name"),
  ]);
  const rows: ExpenseRow[] = [
    ...(vendorResult.data || []).map((r) => ({
      id: r.id,
      source: "vendor" as const,
      groupKey: `vendor:${r.vendor_assignment_id || r.id}`,
      month: r.month,
      name: rel(r.vendors)?.name || "Tedarikçi",
      category:
        [
          rel(r.projects)?.name,
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
      paid:
        (r.vendor_payments as Payment[] | null)?.reduce(
          (a, p) => a + Number(p.amount),
          0,
        ) || 0,
      currency: r.currency,
      billing: r.billing_preference,
      dueDate: r.due_date,
      notes: r.notes,
      requiresReview: r.requires_amount_review,
    })),
    ...(manualResult.data || []).map((r) => ({
      id: r.id,
      source: "manual" as const,
      groupKey: `manual:${r.name}:${r.category}`,
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
    })),
  ];
  const error = vendorResult.error || manualResult.error || accountResult.error;
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
            href={`/expenses?year=${year - 1}&type=${billing}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            ← {year - 1}
          </Link>
          <span className="rounded-lg bg-red-50 px-5 py-2 font-bold text-[#CD0B16]">
            {year}
          </span>
          <Link
            href={`/expenses?year=${year + 1}&type=${billing}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            {year + 1} →
          </Link>
        </div>
        <div className="flex rounded-lg border bg-white p-1">
          <Link
            href={`/expenses?year=${year}&type=invoiced`}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${billing === "invoiced" ? "bg-[#CD0B16] text-white" : "text-slate-500"}`}
          >
            Faturalı giderler
          </Link>
          <Link
            href={`/expenses?year=${year}&type=uninvoiced`}
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
          accounts={accountResult.data || []}
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
    services?: unknown;
  } | null;
}
