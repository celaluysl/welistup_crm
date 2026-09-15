import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startMonthClose, setChecklistItem, reopenMonth } from "@/lib/actions/month-close";
import { MonthCloseForm } from "@/components/forms/month-close-form";
import { MonthCloseCashTargetForm } from "@/components/forms/month-close-cash-target-form";
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
  const [closeResult, transactionsResult, expensesResult, vendorsResult, payrollResult, overdueResult, ownershipResult, salaryProfilesResult, accountsResult, balanceTransactionsResult, settingsResult] = await Promise.all([
    s.from("month_closes").select("*,month_close_checklist(*),profit_distributions(*,profiles(first_name,last_name))").eq("year", year).eq("month", month).maybeSingle(),
    s.from("finance_transactions").select("id,transaction_type,amount,category,description,transaction_date,accounts(name)").gte("transaction_date", start).lte("transaction_date", end).order("transaction_date"),
    s.from("manual_expenses").select("id,name,category,amount,status,billing_preference,manual_expense_payments(amount)").eq("year", year).eq("month", month).neq("status", "cancelled"),
    s.from("vendor_accruals").select("id,amount,status,billing_preference,vendors(name),projects(name),vendor_payments(amount)").eq("year", year).eq("month", month).neq("status", "cancelled"),
    s.from("payroll_periods").select("id,net_payable,status,employment_type,profiles(id,first_name,last_name),payroll_payments(amount)").eq("year", year).eq("month", month).neq("status", "cancelled"),
    s.from("receivables").select("id,total_amount,status,due_date,payments(amount),clients(id,company_name),projects(name),service_periods!inner(year,month)").neq("status", "paid"),
    s.from("partner_ownerships").select("profile_id,ownership_percent,profiles(first_name,last_name)").lte("effective_from", end).or(`effective_to.is.null,effective_to.gte.${start}`),
    s.from("profiles").select("id,first_name,last_name,base_salary,salary_currency,employment_type").eq("status", "active").in("employment_type", ["partner", "employee"]).order("first_name"),
    s.from("accounts").select("id,name,billing_preference,status,opening_balance").eq("status", "active"),
    s.from("finance_transactions").select("account_id,amount").lte("transaction_date", end),
    s.from("month_close_settings").select("invoiced_cash_target,uninvoiced_cash_target").eq("id", true).maybeSingle(),
  ]);

  const close = closeResult.data;
  const transactions = (transactionsResult.data || []) as Row[];
  const expenses = (expensesResult.data || []) as Row[];
  const vendors = (vendorsResult.data || []) as Row[];
  const payroll = (payrollResult.data || []) as Row[];
  const allOpenReceivables = (overdueResult.data || []) as Row[];
  const overdue = allOpenReceivables.filter((row) => periodIndex(row.service_periods) === year * 12 + month);
  const previousOpen = allOpenReceivables.filter((row) => periodIndex(row.service_periods) < year * 12 + month);
  const ownerships = (ownershipResult.data || []) as Row[];
  const salaryProfiles = (salaryProfilesResult.data || []) as Row[];
  const partnerProfiles = salaryProfiles.filter((profile) => profile.employment_type === "partner");

  const cashIncome = sum(transactions.filter((r) => r.transaction_type === "income"), "amount");
  const manualCost = sum(expenses, "amount");
  const vendorCost = sum(vendors, "amount");
  const payrollByProfile = new Map(payroll.map((row) => [profileId(row.profiles), Number(row.net_payable || 0)]));
  const payrollRowsByProfile = new Map(payroll.map((row) => [profileId(row.profiles), row]));
  const payrollCost = salaryProfiles.reduce((total, profile) => total + (payrollByProfile.get(String(profile.id)) ?? Number(profile.base_salary || 0)), 0);
  const invoicedCost =
    sum(expenses.filter((row) => row.billing_preference === "invoiced"), "amount") +
    sum(vendors.filter((row) => row.billing_preference === "invoiced"), "amount");
  const uninvoicedCost =
    sum(expenses.filter((row) => row.billing_preference === "uninvoiced"), "amount") +
    sum(vendors.filter((row) => row.billing_preference === "uninvoiced"), "amount");
  const salaryRows = salaryProfiles.map((profile) => {
    const payrollRow = payrollRowsByProfile.get(String(profile.id));
    const employmentType = String(profile.employment_type) === "partner" ? "Ortak" : "Çalışan";
    const paid = payrollRow ? nestedSum(payrollRow.payroll_payments) : 0;
    return {
      title: person(profile),
      detail: payrollRow
        ? `${employmentType} · ${statusLabel(String(payrollRow.status))} · Ödenen ${formatMoney(paid)}`
        : `${employmentType} · Dönem kaydı oluşturulmadı · Ödenen ${formatMoney(0)}`,
      amount: payrollRow ? Number(payrollRow.net_payable || 0) : Number(profile.base_salary || 0),
    };
  });
  const operatingCost = manualCost + vendorCost;
  const totalPeriodCost = operatingCost + payrollCost;
  const periodResult = cashIncome - totalPeriodCost;
  const openAmount = overdue.reduce((total, r) => total + Math.max(0, Number(r.total_amount || 0) - nestedSum(r.payments)), 0);
  const unpaidClientCount = new Set(overdue.map((row) => relationId(row.clients)).filter(Boolean)).size;
  const previousOpenAmount = previousOpen.reduce((total, row) => total + outstanding(row), 0);
  const partnerPayroll = new Map(payroll.filter((r) => r.employment_type === "partner").map((r) => [profileId(r.profiles), Number(r.net_payable || 0)]));
  const ownershipByProfile = new Map(ownerships.map((o) => [String(o.profile_id), o]));
  const fallbackPercent = partnerProfiles.length ? 100 / partnerProfiles.length : 0;
  const accountMovement = new Map<string, number>();
  for (const row of (balanceTransactionsResult.data || []) as Row[]) {
    const id = String(row.account_id || "");
    accountMovement.set(id, (accountMovement.get(id) || 0) + Number(row.amount || 0));
  }
  const accountRows = ((accountsResult.data || []) as Row[]).map((account) => ({
    name: String(account.name),
    balance: Number(account.opening_balance || 0) + (accountMovement.get(String(account.id)) || 0),
    type: account.billing_preference,
  }));
  const invoicedBalance = accountRows.filter((account) => account.type === "invoiced").reduce((total, account) => total + account.balance, 0);
  const uninvoicedBalance = accountRows.filter((account) => account.type === "uninvoiced").reduce((total, account) => total + account.balance, 0);
  const invoicedTarget = Number(settingsResult.data?.invoiced_cash_target || 0);
  const uninvoicedTarget = Number(settingsResult.data?.uninvoiced_cash_target || 0);
  const invoicedTopUp = Math.max(0, invoicedTarget - invoicedBalance);
  const uninvoicedTopUp = Math.max(0, uninvoicedTarget - uninvoicedBalance);
  const totalTopUp = invoicedTopUp + uninvoicedTopUp;
  const distributableResult = Math.max(0, periodResult - totalTopUp);
  const partnerRows = partnerProfiles.map((profile) => {
    const ownership = ownershipByProfile.get(String(profile.id));
    const percent = ownership ? Number(ownership.ownership_percent || 0) : fallbackPercent;
    const share = distributableResult * percent / 100;
    const salary = partnerPayroll.get(String(profile.id)) ?? Number(profile.base_salary || 0);
    return { id: String(profile.id), name: person(profile), percent, salary, share, total: salary + share, isFallback: !ownership };
  });
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

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ClosingMetric label="Toplam gelen para" value={cashIncome} tone="green" hint="Bu ay gerçekten kasaya giren" />
        <ClosingMetric label="Faturasız giderler" value={uninvoicedCost} tone="orange" hint="Manuel gider + tedarikçi" />
        <ClosingMetric label="Faturalı giderler" value={invoicedCost} tone="blue" hint="KDV dâhil gider + tedarikçi" />
        <ClosingMetric label="Maaş gideri" value={payrollCost} tone="purple" hint={`${salaryProfiles.length} aktif maaş`} />
        <ClosingMetric label="Ay sonu net" value={cashIncome - uninvoicedCost - invoicedCost - payrollCost} tone={cashIncome - uninvoicedCost - invoicedCost - payrollCost >= 0 ? "green" : "red"} hint="Gelen − tüm giderler − maaş" strong />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <ClosingMetric label="Ödemesi gelmeyen müşteri" value={unpaidClientCount} tone="red" hint="Bu aya ait açık müşteriler" format="count" />
        <ClosingMetric label="Ödeme alamadığımız bakiye" value={openAmount} tone="red" hint="Bu ayın açık toplamı" />
        <ClosingMetric label="Geçmiş aylardan kalan" value={previousOpenAmount} tone="orange" hint={`${previousOpen.length} eski açık ödeme`} />
      </section>

      <Card className="mb-6 overflow-hidden">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h2 className="font-bold">Kasa tamamlama ve ortak dağıtımı</h2>
          <p className="mt-1 text-xs text-slate-500">Kasa bakiyeleri ayın son günü itibarıyla hesaplanır. Sabit hedeflere ayrılan tutardan sonra kalan sonuç ortaklara dağıtılır.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <ClosingMetric label="Kasaları tamamlamak için" value={totalTopUp} tone="purple" hint="İki kasanın toplam ihtiyacı" strong />
          <ClosingMetric label="Faturalı kasaya ayrılacak" value={invoicedTopUp} tone="blue" hint={`Bakiye ${formatMoney(invoicedBalance)} · Hedef ${formatMoney(invoicedTarget)}`} />
          <ClosingMetric label="Faturasız kasaya ayrılacak" value={uninvoicedTopUp} tone="orange" hint={`Bakiye ${formatMoney(uninvoicedBalance)} · Hedef ${formatMoney(uninvoicedTarget)}`} />
          <ClosingMetric label="Ortaklara bölünecek" value={distributableResult} tone={distributableResult >= 0 ? "green" : "red"} hint="Net sonuç − kasa tamamlama" strong />
        </div>
        <div className="border-t p-5">
          <MonthCloseCashTargetForm year={year} month={month} invoicedTarget={invoicedTarget} uninvoicedTarget={uninvoicedTarget} />
        </div>
        <div className="grid gap-3 border-t bg-slate-50/60 p-5 md:grid-cols-3">
          {partnerRows.map((partner) => (
            <div key={partner.id} className="rounded-xl border bg-white p-4">
              <div className="text-sm font-bold">{partner.name} alacak</div>
              <div className={`mt-2 text-xl font-bold ${partner.total < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatMoney(partner.total)}</div>
              <div className="mt-1 text-xs text-slate-500">Maaş {formatMoney(partner.salary)} + ortaklık payı {formatMoney(partner.share)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <ReviewTable title="Gelir ve tahsilatlar" subtitle={`${transactions.filter((r) => r.transaction_type === "income").length} kasa hareketi`} rows={transactions.filter((r) => r.transaction_type === "income").map((r) => ({ title: String(r.description || r.category || "Tahsilat"), detail: `${date(r.transaction_date)} · ${relationName(r.accounts)}`, amount: Number(r.amount || 0) }))} empty="Bu ay tahsilat kaydı yok." />
        <ReviewTable title="Gider tahakkukları" subtitle={`Manuel ${formatMoney(manualCost)} · Tedarikçi ${formatMoney(vendorCost)}`} rows={[...expenses.map((r) => ({ title: String(r.name), detail: `${r.category} · ${statusLabel(String(r.status))}`, amount: Number(r.amount || 0) })), ...vendors.map((r) => ({ title: relationName(r.vendors), detail: `${relationName(r.projects)} · ${statusLabel(String(r.status))}`, amount: Number(r.amount || 0) }))]} empty="Bu ay gider tahakkuku yok." />
        <ReviewTable title="Maaşlar" subtitle={`${payroll.length} dönem kaydı · ${salaryProfiles.length} aktif maaş`} rows={salaryRows} empty="Aktif maaş profili bulunamadı." />
        <ReviewTable title="Ödenmemiş ve açık alacaklar" subtitle={`${overdue.length} kayıt · Açık toplam ${formatMoney(openAmount)}`} rows={overdue.map((r) => ({ title: relationName(r.clients), detail: `${relationName(r.projects)} · Vade ${date(r.due_date)} · ${statusLabel(String(r.status))}`, amount: Math.max(0, Number(r.total_amount || 0) - nestedSum(r.payments)) }))} empty="Ödenmemiş açık alacak yok." />
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
function ClosingMetric({ label, value, tone, hint, strong, format = "money" }: { label: string; value: number; tone: "green" | "orange" | "blue" | "purple" | "red"; hint: string; strong?: boolean; format?: "money" | "count" }) { const styles = { green: "border-emerald-200 bg-emerald-50 text-emerald-800", orange: "border-orange-200 bg-orange-50 text-orange-800", blue: "border-blue-200 bg-blue-50 text-blue-800", purple: "border-violet-200 bg-violet-50 text-violet-800", red: "border-red-200 bg-red-50 text-red-800" }; return <Card className={`p-4 ${styles[tone]} ${strong ? "ring-1 ring-current/10" : ""}`}><div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div><div className="mt-2 text-xl font-bold">{format === "money" ? formatMoney(value) : `${value} müşteri`}</div><div className="mt-1 text-[11px] opacity-70">{hint}</div></Card>; }
function ReviewTable({ title, subtitle, rows, empty }: { title: string; subtitle: string; rows: { title: string; detail: string; amount: number }[]; empty: string }) { return <Card className="overflow-hidden"><div className="flex items-end justify-between border-b bg-slate-50 px-5 py-4"><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><b>{formatMoney(rows.reduce((n, r) => n + r.amount, 0))}</b></div><div className="max-h-80 divide-y overflow-y-auto">{rows.map((r, i) => <div key={`${r.title}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{r.title}</div><div className="mt-0.5 truncate text-xs text-slate-400">{r.detail}</div></div><b className="shrink-0 text-sm">{formatMoney(r.amount)}</b></div>)}{!rows.length && <p className="p-6 text-center text-sm text-slate-400">{empty}</p>}</div></Card>; }
function sum(rows: Row[], field: string) { return rows.reduce((n, r) => n + Number(r[field] || 0), 0); }
function nestedSum(value: unknown) { return Array.isArray(value) ? value.reduce((n, r) => n + Number((r as Row).amount || 0), 0) : 0; }
function relationName(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return String(v?.company_name || v?.name || "—"); }
function relationId(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return String(v?.id || ""); }
function periodIndex(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return Number(v?.year || 0) * 12 + Number(v?.month || 0); }
function outstanding(row: Row) { return Math.max(0, Number(row.total_amount || 0) - nestedSum(row.payments)); }
function profileId(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return String(v?.id || ""); }
function person(value: unknown) { const v = (Array.isArray(value) ? value[0] : value) as Row | null; return `${v?.first_name || ""} ${v?.last_name || ""}`.trim() || "Ortak"; }
function date(value: unknown) { return value ? new Date(String(value)).toLocaleDateString("tr-TR") : "—"; }
function statusLabel(value: string) { return ({ paid: "Ödendi", partial: "Kısmi", pending: "Bekliyor" } as Record<string, string>)[value] || value; }
