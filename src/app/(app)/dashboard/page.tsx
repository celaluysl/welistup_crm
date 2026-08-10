import Link from "next/link";
import {
  Banknote,
  Building2,
  Clock3,
  FileWarning,
  FolderKanban,
  Handshake,
  ListTodo,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/utils";

type Summary = Record<string, number>;
export default async function Dashboard() {
  const s = await createClient(),
    today = new Date().toISOString().slice(0, 10),
    now = new Date(),
    year = now.getFullYear(),
    month = now.getMonth() + 1;
  const [
    { data: finance },
    { data: collections },
    { data: operations },
    { data: sales },
  ] = await Promise.all([
    s.rpc("has_permission", { requested: "finance.read" }),
    s.rpc("has_permission", { requested: "collections.read" }),
    s.rpc("has_permission", { requested: "operations.read" }),
    s.rpc("has_permission", { requested: "sales.read" }),
  ]);
  const base = await Promise.all([
    s
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    s
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);
  const financeSummary = finance
    ? ((
        await s.rpc("finance_dashboard_summary", {
          p_year: year,
          p_month: month,
        })
      ).data as Summary | null)
    : null;
  const collectionSummary =
    finance || collections
      ? ((await s.rpc("collection_dashboard_summary")).data as Summary | null)
      : null;
  const operationSummary = operations
    ? await Promise.all([
        s
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .neq("status", "completed"),
        s
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .lt("due_date", today)
          .neq("status", "completed"),
        s
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting_client"),
        s
          .from("reports")
          .select("id", { count: "exact", head: true })
          .in("status", ["planned", "preparing"]),
      ])
    : [];
  const salesSummary = sales
    ? await Promise.all([
        s
          .from("leads")
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(won,lost)"),
        s
          .from("offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),
        s
          .from("leads")
          .select("estimated_budget")
          .not("status", "in", "(won,lost)"),
      ])
    : [];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Rolünüze göre Welistup finans, operasyon ve satış özeti."
      />
      {financeSummary && (
        <Section title="Finans">
          <MetricGrid
            items={[
              {
                label: "Bu ay tahakkuk",
                value: formatMoney(financeSummary.accrual_revenue),
                icon: TrendingUp,
                href: "/financial-reports",
              },
              {
                label: "Bu ay tahsilat",
                value: formatMoney(financeSummary.cash_collections),
                icon: WalletCards,
                href: "/collections",
              },
              {
                label: "Bekleyen tahsilat",
                value: formatMoney(financeSummary.outstanding_receivables),
                icon: ReceiptText,
                href: "/collections",
              },
              {
                label: "Gecikmiş tahsilat",
                value: formatMoney(financeSummary.overdue_receivables),
                icon: Clock3,
                href: "/collections",
              },
              {
                label: "Vendor maliyeti",
                value: formatMoney(financeSummary.vendor_costs),
                icon: Banknote,
                href: "/vendors",
              },
              {
                label: "Tahmini dönem kârı",
                value: formatMoney(financeSummary.estimated_profit),
                icon: TrendingUp,
                href: "/financial-reports",
              },
            ]}
          />
        </Section>
      )}
      {!financeSummary && collectionSummary && (
        <Section title="Tahsilat">
          <MetricGrid
            items={[
              {
                label: "Bekleyen alacak",
                value: formatMoney(collectionSummary.outstanding_amount),
                icon: ReceiptText,
                href: "/collections",
              },
              {
                label: "Gecikmiş alacak",
                value: formatMoney(collectionSummary.overdue_amount),
                icon: Clock3,
                href: "/collections",
              },
              {
                label: "Kısmi ödeme",
                value: collectionSummary.partial_count,
                icon: WalletCards,
                href: "/collections?status=partial",
              },
            ]}
          />
        </Section>
      )}
      <Section title="Müşteriler">
        <MetricGrid
          items={[
            {
              label: "Aktif müşteri",
              value: base[0].count ?? 0,
              icon: Building2,
              href: "/clients",
            },
            {
              label: "Aktif proje",
              value: base[1].count ?? 0,
              icon: FolderKanban,
              href: "/projects",
            },
          ]}
        />
      </Section>
      {operations && (
        <Section title="Operasyon">
          <MetricGrid
            items={[
              {
                label: "Açık görev",
                value: operationSummary[0]?.count ?? 0,
                icon: ListTodo,
                href: "/projects",
              },
              {
                label: "Gecikmiş görev",
                value: operationSummary[1]?.count ?? 0,
                icon: Clock3,
                href: "/projects",
              },
              {
                label: "Müşteri bekleniyor",
                value: operationSummary[2]?.count ?? 0,
                icon: Clock3,
                href: "/projects",
              },
              {
                label: "Bekleyen rapor",
                value: operationSummary[3]?.count ?? 0,
                icon: FileWarning,
                href: "/reports",
              },
            ]}
          />
        </Section>
      )}
      {sales && (
        <Section title="Satış">
          <MetricGrid
            items={[
              {
                label: "Açık lead",
                value: salesSummary[0]?.count ?? 0,
                icon: Handshake,
                href: "/sales",
              },
              {
                label: "Gönderilmiş teklif",
                value: salesSummary[1]?.count ?? 0,
                icon: ReceiptText,
                href: "/offers",
              },
              {
                label: "Pipeline değeri",
                value: formatMoney(
                  (salesSummary[2]?.data || []).reduce(
                    (sum, x) => sum + Number(x.estimated_budget || 0),
                    0,
                  ),
                ),
                icon: TrendingUp,
                href: "/sales",
              },
            ]}
          />
        </Section>
      )}
    </>
  );
}
type Item = {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  href: string;
};
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}
function MetricGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ label, value, icon: Icon, href }) => (
        <Link key={label} href={href}>
          <Card className="p-5 transition hover:border-red-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="rounded-lg bg-red-50 p-2 text-[#CD0B16]">
                <Icon size={18} />
              </span>
            </div>
            <div className="mt-4 text-2xl font-bold">{value}</div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
