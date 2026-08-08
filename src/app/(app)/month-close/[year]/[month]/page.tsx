import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  startMonthClose,
  setChecklistItem,
  reopenMonth,
} from "@/lib/actions/month-close";
import { MonthCloseForm } from "@/components/forms/month-close-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
type Snapshot = {
  accrual_revenue?: number;
  cash_collections?: number;
  vendor_costs?: number;
  payroll_costs?: number;
  reserve_amount?: number;
  distributable_profit?: number;
};
export default async function MonthClose({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const p = await params,
    year = Number(p.year),
    month = Number(p.month);
  if (!Number.isInteger(year) || month < 1 || month > 12) notFound();
  const s = await createClient();
  const { data: close } = await s
    .from("month_closes")
    .select(
      "*,month_close_checklist(*),profit_distributions(*,profiles(first_name,last_name))",
    )
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  const title = new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month - 1));
  if (!close)
    return (
      <>
        <PageHeader
          title={`Ay Kapanışı · ${title}`}
          description="Kapanış checklist'i ve finansal snapshot henüz başlatılmadı."
        />
        <Card className="max-w-xl p-8">
          <form action={startMonthClose}>
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <button className="h-10 rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white">
              Kapanış sürecini başlat
            </button>
          </form>
        </Card>
      </>
    );
  const snapshot = (close.snapshot || {}) as Snapshot;
  return (
    <>
      <PageHeader
        title={`Ay Kapanışı · ${title}`}
        description={
          close.status === "closed"
            ? `Kilitli · ${new Date(close.closed_at).toLocaleString("tr-TR")}`
            : "Checklist tamamlandığında finansal snapshot oluşturularak dönem kilitlenir."
        }
      />
      {close.status === "closed" && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Tahakkuk geliri" value={snapshot.accrual_revenue} />
          <Summary label="Nakit tahsilat" value={snapshot.cash_collections} />
          <Summary label="Tedarikçi maliyeti" value={snapshot.vendor_costs} />
          <Summary label="Maaş maliyeti" value={snapshot.payroll_costs} />
          <Summary label="Rezerv" value={snapshot.reserve_amount} />
          <Summary
            label="Dağıtılabilir kâr"
            value={snapshot.distributable_profit}
            highlight
          />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Kapanış kontrol listesi</h2>
          <div className="space-y-2">
            {[...(close.month_close_checklist || [])]
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <form
                  key={item.id}
                  action={setChecklistItem.bind(
                    null,
                    item.id,
                    close.id,
                    year,
                    month,
                  )}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <input
                    type="checkbox"
                    name="completed"
                    defaultChecked={item.is_completed}
                    disabled={close.status === "closed"}
                  />
                  <span
                    className={
                      item.is_completed ? "text-slate-400 line-through" : ""
                    }
                  >
                    {item.label}
                  </span>
                  {close.status !== "closed" && (
                    <button className="ml-auto text-xs font-semibold text-[#CD0B16]">
                      Kaydet
                    </button>
                  )}
                </form>
              ))}
          </div>
        </Card>
        <Card className="h-fit p-6">
          {close.status === "open" ? (
            <>
              <h2 className="mb-5 font-semibold">Dönemi kapat</h2>
              <MonthCloseForm closeId={close.id} year={year} month={month} />
            </>
          ) : (
            <>
              <h2 className="font-semibold">Kapanış notu</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                {close.notes || "Not yok."}
              </p>
              <div className="mt-6 border-t pt-5">
                <h3 className="mb-3 text-sm font-semibold">
                  Ortak kâr payları
                </h3>
                {close.profit_distributions?.map(
                  (d: {
                    id: string;
                    amount: number;
                    currency: string;
                    ownership_percent: number;
                    profiles: unknown;
                  }) => (
                    <div
                      key={d.id}
                      className="flex justify-between py-2 text-sm"
                    >
                      <span>
                        {person(d.profiles)} · %{d.ownership_percent}
                      </span>
                      <b>{formatMoney(d.amount, d.currency)}</b>
                    </div>
                  ),
                )}
              </div>
              <form
                action={reopenMonth.bind(null, close.id, year, month)}
                className="mt-6"
              >
                <button className="text-sm font-semibold text-[#CD0B16]">
                  Ayı yeniden aç
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
function Summary({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: number;
  highlight?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-xl font-bold ${highlight ? "text-[#CD0B16]" : ""}`}
      >
        {formatMoney(value || 0, "TRY")}
      </div>
    </Card>
  );
}
function person(v: unknown) {
  const p = (Array.isArray(v) ? v[0] : v) as {
    first_name?: string;
    last_name?: string;
  } | null;
  return `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Ortak";
}
