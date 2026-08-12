import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startMonthClose, setChecklistItem, reopenMonth } from "@/lib/actions/month-close";
import { MonthCloseForm } from "@/components/forms/month-close-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

type Row = Record<string, unknown>;
type Snapshot = Record<string, number | Record<string, number> | undefined>;

export default async function MonthClose({ params }: { params: Promise<{ year: string; month: string }> }) {
  const p = await params;
  const year = Number(p.year), month = Number(p.month);
  if (!Number.isInteger(year) || month < 1 || month > 12) notFound();

  const s = await createClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);
  const [closeResult, periodsResult, transactionsResult, expensesResult, vendorsResult, payrollResult, overdueResult, ownershipResult, accountsResult, balancesResult] = await Promise.all([
    s.from("month_closes").select("*,month_close_checklist(*),profit_distributions(*,profiles(first_name,last_name))").eq("year", year).eq("month", month).maybeSingle(),
    s.from("service_periods").select("id,net_amount,vat_amount,gross_amount,billing_preference,invoice_status,collection_status,due_date,clients(name),projects(name),services(name)").eq("year", year).eq("month", month),
    s.from("finance_transactions").select("id,transaction_type,amount,category,description,transaction_date,accounts(name)").gte("transaction_date", start).lte("transaction_date", end).order("transaction_date"),
    s.from("manual_expenses").select("id,name,category,amount,status,billing_preference,manual_expense_payments(amount)").eq("year", year).eq("month", month).neq("status", "cancelled"),
    s.from("vendor_accruals").select("id,amount,status,vendors(name),projects(name),vendor_payments(amount)").eq("year", year).eq("month", month).neq("status", "cancelled"),
    s.from("payroll_periods").select("id,net_payable,status,employment_type,profiles(id,first_name,last_name),payroll_payments(amount)").eq("year", year).eq("month", month).neq("status", "cancelled"),
    s.from("receivables").select("id,total_amount,status,due_date,payments(amount),clients(name),projects(name)").lte("due_date", end).neq("status", "paid").neq("status", "cancelled"),
    s.from("partner_ownerships").select("profile_id,ownership_percent,profiles(first_name,last_name)").lte("effective_from", end).or(`effective_to.is.null,effective_to.gte.${start}`),
    s.from("accounts").select("id,name,billing_preference,status").eq("status", "active"),
    s.rpc("account_balances"),
  ]);

  const close = closeResult.data;
  const periods = (periodsResult.data || []) as Row[];
  const transactions = (transactionsResult.data || []) as Row[];
  const expenses = (expensesResult.data || []) as Row[];
  const vendors = (vendorsResult.data || []) as Row[];
  const payroll = (payrollResult.data || []) as Row[];
  const overdue = (overdueResult.data || []) as Row[];
  const ownerships = (ownershipResult.data || []) as Row[];

  const cashIncome = sum(transactions.filter((r) => r.transaction_type === "income"), "amount");
  const cashExpense = Math.abs(sum(transactions.filter((r) => r.transaction_type === "expense"), "amount"));
  const accruedIncome = sum(periods, "gross_amount");
  const manualCost = sum(expenses, "amount");
  const vendorCost = sum(vendors, "amount");
  const payrollCost = sum(payroll, "net_payable");
  const operatingCost = manualCost + vendorCost;
  const periodResult = cashIncome - operatingCost - payrollCost;
  const overdueAmount = overdue.reduce((total, r) => total + Math.max(0, Number(r.total_amount || 0) - nestedSum(r.payments)), 0);
  const invoiceWaiting = periods.filter((r) => r.invoice_status === "waiting").length;
  const collectionWaiting = periods.filter((r) => r.collection_status !== "paid").length;
  const partnerPayroll = new Map(payroll.filter((r) => r.employment_type === "partner").map((r) => [profileId(r.profiles), Number(r.net_payable || 0)]));
  const partnerRows = ownerships.map((o) => {
    const share = periodResult * Number(o.ownership_percent || 0) / 100;
    const salary = partnerPayroll.get(String(o.profile_id)) || 0;
    return { name: person(o.profiles), percent: Number(o.ownership_percent || 0), salary, share, total: salary + share };
  });
  const balances = new Map(((balancesResult.data || []) as Row[]).map((b) => [String(b.account_id), Number(b.balance || 0)]));
  const accountRows = ((accountsResult.data || []) as Row[]).map((a) => ({ name: String(a.name), balance: balances.get(String(a.id)) || 0, type: a.billing_preference }));
  const title = new Intl.DateTimeFormat("tr-TR", { year: "numeric", month: "long" }).format(new Date(year, month - 1));
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const snapshot = (close?.snapshot || {}) as Snapshot;

  return (
    <>
      <PageHeader title={`Ay Kapanışı · ${title}`} description="Gelir, gider, maaş, alacak, kasa ve ortak sonuçlarını aynı ekranda doğrulayarak dönemi kapatın." />
      <div className="mb-5 flex items-center gap-2">
        <MonthLink href={`/month-close/${prev.year}/${prev.month}`}>← Önceki ay</MonthLink>
        <span className="rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-[#CD0B16]">{title}</span>
        <MonthLink href={`/month-close/${next.year}/${next.month}`}>Sonraki ay →</MonthLink>
        {close?.status === "closed" && <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Kapanış tamamlandı</span>}
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-4"><h2 className="font-bold">Aylık finansal sonuç</h2><p className="mt-1 text-xs text-slate-500">Tahsil edilen gelir esas alınır; gider ve maaşlar ilgili aya ait tahakkuklardan hesaplanır.</p></div>
        <div className="grid divide-y lg:grid-cols-[1fr_260px] lg:divide-x lg:divide-y-0">
          <div className="divide-y">
            <ResultRow label="Bu ay tahsil edilen gelir" value={cashIncome} tone="green" hint={`Aylık tahakkuk: ${formatMoney(accruedIncome)}`} />
            <ResultRow label="Gider + maaş toplamı" value={operatingCost + payrollCost} tone="blue" hint={`Operasyon ${formatMoney(operatingCost)} · Maaş ${formatMoney(payrollCost)}`} />
            <ResultRow label="Ortaklara kalan toplam tutar" value={periodResult} tone={periodResult >= 0 ? "green" : "red"} strong />
          </div>
          <div className={`flex flex-col justify-center p-6 ${periodResult >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kişi başı eşit pay</span>
            <b className={`mt-2 text-2xl ${periodResult >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatMoney(partnerRows.length ? periodResult / partnerRows.length : 0)}</b>
            <span className="mt-1 text-xs text-slate-500">Aktif {partnerRows.length} ortak</span>
          </div>
        </div>
        <div className="border-t bg-slate-50/60 p-5">
          <div className="mb-4">
            <h3 className="font-bold">Ortakların aylık gelirleri</h3>
            <p className="mt-1 text-xs text-slate-500">Sabit maaş ile dönem sonucundan gelen ortaklık payı birlikte hesaplanır.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {partnerRows.map((partner) => (
              <div key={partner.name} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="text-base font-bold text-slate-900">{partner.name}</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-500">Maaş</span><b>{formatMoney(partner.salary)}</b></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Ortaklık payı <small>· %{partner.percent.toFixed(2)}</small></span><b className={partner.share < 0 ? "text-red-600" : "text-emerald-700"}>{formatMoney(partner.share)}</b></div>
                </div>
                <div className={`mt-4 rounded-lg p-4 ${partner.total < 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toplam gelir</div>
                  <div className={`mt-1 text-xl font-bold ${partner.total < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatMoney(partner.total)}</div>
                  <div className="mt-1 text-xs text-slate-400">Maaş + ortaklık payı</div>
                </div>
              </div>
            ))}
            {!partnerRows.length && <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700 md:col-span-3">Bu ay için aktif ortaklık oranı bulunamadı.</p>}
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Bekleyen fatura" value={`${invoiceWaiting} kayıt`} warning={invoiceWaiting > 0} />
        <Metric label="Bekleyen tahsilat" value={`${collectionWaiting} kayıt`} warning={collectionWaiting > 0} />
        <Metric label="Vadesi geçmiş alacak" value={formatMoney(overdueAmount)} warning={overdueAmount > 0} />
        <Metric label="Ay içi kasa çıkışı" value={formatMoney(cashExpense)} />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <ReviewTable title="Gelir ve tahsilatlar" subtitle={`${transactions.filter((r) => r.transaction_type === "income").length} kasa hareketi`} rows={transactions.filter((r) => r.transaction_type === "income").map((r) => ({ title: String(r.description || r.category || "Tahsilat"), detail: `${date(r.transaction_date)} · ${relationName(r.accounts)}`, amount: Number(r.amount || 0) }))} empty="Bu ay tahsilat kaydı yok." />
        <ReviewTable title="Gider tahakkukları" subtitle={`Manuel ${formatMoney(manualCost)} · Tedarikçi ${formatMoney(vendorCost)}`} rows={[...expenses.map((r) => ({ title: String(r.name), detail: `${r.category} · ${statusLabel(String(r.status))}`, amount: Number(r.amount || 0) })), ...vendors.map((r) => ({ title: relationName(r.vendors), detail: `${relationName(r.projects)} · ${statusLabel(String(r.status))}`, amount: Number(r.amount || 0) }))]} empty="Bu ay gider tahakkuku yok." />
        <ReviewTable title="Maaşlar" subtitle={`${payroll.length} maaş kaydı`} rows={payroll.map((r) => ({ title: person(r.profiles), detail: `${r.employment_type === "partner" ? "Ortak" : "Çalışan"} · ${statusLabel(String(r.status))} · Ödenen ${formatMoney(nestedSum(r.payroll_payments))}`, amount: Number(r.net_payable || 0) }))} empty="Bu ay maaş kaydı yok." />
        <ReviewTable title="Gecikmiş ve açık alacaklar" subtitle={`${overdue.length} kayıt`} rows={overdue.slice(0, 12).map((r) => ({ title: relationName(r.clients), detail: `${relationName(r.projects)} · Vade ${date(r.due_date)}`, amount: Math.max(0, Number(r.total_amount || 0) - nestedSum(r.payments)) }))} empty="Gecikmiş açık alacak yok." />
      </div>

      <Card className="mb-6 p-6"><div className="mb-4 flex items-end justify-between"><div><h2 className="font-bold">Kasa mutabakatı</h2><p className="mt-1 text-xs text-slate-500">Tüm hareketlerden sonraki güncel kasa bakiyeleri.</p></div><b className="text-lg">{formatMoney(accountRows.reduce((n, a) => n + a.balance, 0))}</b></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{accountRows.map((a) => <div key={a.name} className={`rounded-xl border p-4 ${a.type === "invoiced" ? "bg-blue-50/60" : "bg-orange-50/60"}`}><div className="text-xs text-slate-500">{a.name}</div><b className="mt-1 block">{formatMoney(a.balance)}</b></div>)}</div></Card>

      {!close ? <Card className="p-8"><h2 className="font-bold">Kontrol ve onay sürecini başlat</h2><p className="mt-2 text-sm text-slate-500">Rakamları yukarıdan kontrol ettikten sonra checklist ve kapanış onayı açılır.</p><form action={startMonthClose} className="mt-5"><input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} /><button className="h-10 rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white">Kapanış sürecini başlat</button></form></Card> : (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card className="p-6"><h2 className="mb-2 font-semibold">Kapanış kontrol listesi</h2><p className="mb-5 text-xs text-slate-500">Her maddeyi yukarıdaki detaylardan doğrulayıp onaylayın.</p><div className="grid gap-2 sm:grid-cols-2">{[...(close.month_close_checklist || [])].sort((a, b) => a.position - b.position).map((item) => <form key={item.id} action={setChecklistItem.bind(null, item.id, close.id, year, month)} className={`flex items-center gap-3 rounded-lg border p-3 ${item.is_completed ? "border-emerald-200 bg-emerald-50" : ""}`}><input type="checkbox" name="completed" defaultChecked={item.is_completed} disabled={close.status === "closed"} /><span className={`text-sm ${item.is_completed ? "text-emerald-800" : ""}`}>{item.label}</span>{close.status !== "closed" && <button className="ml-auto text-xs font-semibold text-[#CD0B16]">Onayla</button>}</form>)}</div></Card>
          <Card className="h-fit p-6">{close.status === "open" ? <><h2 className="mb-2 font-semibold">Dönemi onayla ve kapat</h2><p className="mb-5 text-xs text-slate-500">Rezerv, ortaklara kalan tutardan düşülür. Kapanış sonrası rakamlar snapshot olarak saklanır.</p><MonthCloseForm closeId={close.id} year={year} month={month} /></> : <><h2 className="font-semibold">Kapanış özeti</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{close.notes || "Not yok."}</p><div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm"><div className="flex justify-between"><span>Kaydedilen dağıtılabilir kâr</span><b>{formatMoney(Number(snapshot.distributable_profit || 0))}</b></div></div><form action={reopenMonth.bind(null, close.id, year, month)} className="mt-6"><button className="text-sm font-semibold text-[#CD0B16]">Ayı yeniden aç</button></form></>}</Card>
        </div>
      )}
    </>
  );
}

function MonthLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-[#CD0B16] hover:text-[#CD0B16]">{children}</Link>; }
function ResultRow({ label, value, tone, hint, strong }: { label: string; value: number; tone: "green" | "blue" | "red"; hint?: string; strong?: boolean }) { const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-blue-700"; return <div className={`flex items-center justify-between gap-4 px-5 py-4 ${strong ? "bg-slate-50" : ""}`}><div><div className={strong ? "font-bold" : "font-medium"}>{label}</div>{hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}</div><b className={`text-lg ${color}`}>{formatMoney(value)}</b></div>; }
function Metric({ label, value, warning }: { label: string; value: string; warning?: boolean }) { return <Card className={`p-5 ${warning ? "border-red-200 bg-red-50/60" : ""}`}><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-2 text-xl font-bold ${warning ? "text-red-700" : ""}`}>{value}</div></Card>; }
function ReviewTable({ title, subtitle, rows, empty }: { title: string; subtitle: string; rows: { title: string; detail: string; amount: number }[]; empty: string }) { return <Card className="overflow-hidden"><div className="flex items-end justify-between border-b bg-slate-50 px-5 py-4"><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><b>{formatMoney(rows.reduce((n, r) => n + r.amount, 0))}</b></div><div className="max-h-80 divide-y overflow-y-auto">{rows.map((r, i) => <div key={`${r.title}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{r.title}</div><div className="mt-0.5 truncate text-xs text-slate-400">{r.detail}</div></div><b className="shrink-0 text-sm">{formatMoney(r.amount)}</b></div>)}{!rows.length && <p className="p-6 text-center text-sm text-slate-400">{empty}</p>}</div></Card>; }
function sum(rows: Row[], field: string) { return rows.reduce((n, r) => n + Number(r[field] || 0), 0); }
function nestedSum(value: unknown) { return Array.isArray(value) ? value.reduce((n, r) => n + Number((r as Row).amount || 0), 0) : 0; }
function relationName(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return String(v?.name || "—"); }
function profileId(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return String(v?.id || ""); }
function person(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return `${v?.first_name || ""} ${v?.last_name || ""}`.trim() || "Ortak"; }
function date(value: unknown) { return value ? new Date(String(value)).toLocaleDateString("tr-TR") : "—"; }
function statusLabel(value: string) { return ({ paid: "Ödendi", partial: "Kısmi", pending: "Bekliyor" } as Record<string, string>)[value] || value; }
