import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import {
  CollectionWorkspace,
  CollectionRow,
} from "@/components/collections/collection-workspace";
import { YearPeriodButton } from "@/components/collections/year-period-button";
import {
  HostingCollectionSection,
  type HostingPaymentHistoryRow,
  type HostingReceivableRow,
} from "@/components/hosting/hosting-collection-section";

export default async function Collections({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const parsedYear = Number(params.year || now.getFullYear());
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2200
      ? parsedYear
      : now.getFullYear();
  const supabase = await createClient();
  await supabase.rpc("generate_hosting_receivables");
  const [
    { data, error },
    { data: accounts },
    { data: services },
    { data: hostingReceivables, error: hostingError },
    { data: hostingSubscriptions, error: hostingSubscriptionsError },
    { data: hostingPayments, error: hostingPaymentsError },
  ] = await Promise.all([
    supabase
      .from("receivables")
      .select(
        "id,total_amount,currency,due_date,status,coverage_start,coverage_end,clients(company_name),projects(name),payments(id,amount,payment_date,account_id,notes,accounts(name)),unallocated_customer_receipts(id,amount,remaining_amount,received_date,status,notes,custom_service_name,services(name),accounts(name)),service_periods!inner(year,month,billing_preference,project_service_id,services(name))",
      )
      .eq("service_periods.year", year)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("accounts")
      .select("id,name,currency,billing_preference")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("services")
      .select("id,name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("hosting_receivables")
      .select(
        "id,due_date,amount,currency,billing_preference,status,hosting_subscriptions(domain,account_label),clients(company_name),hosting_payments(amount)",
      )
      .gte("due_date", `${year}-01-01`)
      .lte("due_date", `${year}-12-31`)
      .neq("status", "cancelled")
      .order("due_date"),
    supabase
      .from("hosting_subscriptions")
      .select("id,domain,account_label,currency,status,clients(company_name)")
      .eq("is_paid", true)
      .order("domain"),
    supabase
      .from("hosting_payments")
      .select(
        "amount,currency,payment_date,hosting_receivables!inner(subscription_id)",
      )
      .gte("payment_date", `${year}-01-01`)
      .lte("payment_date", `${year}-12-31`)
      .order("payment_date"),
  ]);
  const rows: CollectionRow[] = (data || []).map((record) => {
    const period = relation(record.service_periods) as {
      year: number;
      month: number;
      billing_preference: "invoiced" | "uninvoiced";
      project_service_id: string;
      services: unknown;
    };
    const payments = (record.payments || []).map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.payment_date,
      accountId: payment.account_id,
      accountName: relation(payment.accounts)?.name || null,
      notes: payment.notes,
    }));
    const excessReceipts = (record.unallocated_customer_receipts || []).map(
      (receipt) => ({
        id: receipt.id,
        amount: Number(receipt.amount),
        remainingAmount: Number(receipt.remaining_amount),
        receivedDate: receipt.received_date,
        status: receipt.status,
        accountName: relation(receipt.accounts)?.name || null,
        notes: receipt.notes,
        matchedService:
          relation(receipt.services)?.name ||
          receipt.custom_service_name ||
          null,
      }),
    );
    return {
      id: record.id,
      projectServiceId: period.project_service_id,
      month: period.month,
      client: relation(record.clients)?.company_name || "—",
      project: relation(record.projects)?.name || "—",
      service: relation(period.services)?.name || "Hizmet",
      billing: period.billing_preference,
      total: Number(record.total_amount),
      paid: payments.reduce((sum, payment) => sum + payment.amount, 0),
      currency: record.currency,
      dueDate: record.due_date,
      coverageStart: record.coverage_start,
      coverageEnd: record.coverage_end,
      status: record.status,
      payments,
      excessReceipts,
    };
  });
  const hostingRows: HostingReceivableRow[] = (hostingReceivables || []).map(
    (record) => ({
      id: record.id,
      domain: relation(record.hosting_subscriptions)?.domain || "Sunucu",
      customer:
        relation(record.clients)?.company_name ||
        relation(record.hosting_subscriptions)?.account_label ||
        "Bağımsız kayıt",
      dueDate: record.due_date,
      amount: Number(record.amount),
      paid: (record.hosting_payments || []).reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      ),
      currency: record.currency,
      billing: record.billing_preference,
      status: record.status,
    }),
  );
  const hostingPaymentsBySubscription = new Map<
    string,
    Map<number, { amount: number; count: number }>
  >();
  for (const payment of hostingPayments || []) {
    const subscriptionId = relation(payment.hosting_receivables)?.subscription_id;
    if (!subscriptionId) continue;
    const month = Number(payment.payment_date.slice(5, 7));
    const subscriptionMonths =
      hostingPaymentsBySubscription.get(subscriptionId) || new Map();
    const current = subscriptionMonths.get(month) || { amount: 0, count: 0 };
    subscriptionMonths.set(month, {
      amount: current.amount + Number(payment.amount),
      count: current.count + 1,
    });
    hostingPaymentsBySubscription.set(subscriptionId, subscriptionMonths);
  }
  const hostingHistoryRows: HostingPaymentHistoryRow[] = (
    hostingSubscriptions || []
  ).map((subscription) => ({
    subscriptionId: subscription.id,
    domain: subscription.domain,
    customer:
      relation(subscription.clients)?.company_name ||
      subscription.account_label ||
      "Bağımsız kayıt",
    currency: subscription.currency,
    status: subscription.status,
    months: Array.from(
      hostingPaymentsBySubscription.get(subscription.id)?.entries() || [],
    ).map(([month, payment]) => ({ month, ...payment })),
  }));
  return (
    <>
      <PageHeader
        title="Alacak ve Tahsilat"
        description="Otomatik oluşan aylık alacakları, gecikmeleri ve kasaya giren ödemeleri takip edin."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/collections?year=${year - 1}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            ← {year - 1}
          </Link>
          <div className="rounded-lg border border-red-100 bg-red-50 px-5 py-2 font-bold text-[#CD0B16]">
            {year}
          </div>
          <Link
            href={`/collections?year=${year + 1}`}
            className="rounded-lg border bg-white px-3 py-2 text-sm"
          >
            {year + 1} →
          </Link>
        </div>
        <YearPeriodButton year={year} />
      </div>
      {error ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-red-600">
          Tahsilat kayıtları yüklenemedi: {error.message}
        </div>
      ) : (
        <CollectionWorkspace
          rows={rows}
          accounts={accounts || []}
          services={services || []}
          year={year}
        />
      )}
      {!hostingError &&
        !hostingSubscriptionsError &&
        !hostingPaymentsError && (
        <HostingCollectionSection
          rows={hostingRows}
          historyRows={hostingHistoryRows}
          accounts={accounts || []}
          year={year}
        />
      )}
    </>
  );
}

function relation(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    company_name?: string;
    name?: string;
    domain?: string;
    account_label?: string;
    subscription_id?: string;
  } | null;
}
