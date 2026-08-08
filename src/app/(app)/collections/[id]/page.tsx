import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PaymentForm,
  CollectionActivityForm,
} from "@/components/forms/collection-forms";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

const activityLabels: Record<string, string> = {
  call: "Telefon",
  whatsapp: "WhatsApp",
  email: "E-posta",
  promise: "Ödeme sözü",
  partial_payment: "Parçalı ödeme",
  completed: "Tamamlandı",
  note: "Not",
};
type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
};
type Activity = {
  id: string;
  activity_type: string;
  note: string | null;
  promised_payment_date: string | null;
  activity_at: string;
  profiles: unknown;
};

export default async function CollectionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: r }, { data: accounts }] = await Promise.all([
    supabase
      .from("receivables")
      .select(
        "*,clients(company_name),projects(name),service_periods(year,month,services(name)),payments(id,amount,payment_date,notes),collection_activities(id,activity_type,note,promised_payment_date,activity_at,profiles(first_name,last_name))",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("accounts")
      .select("id,name,currency")
      .eq("status", "active")
      .order("name"),
  ]);
  if (!r) notFound();
  const payments = (r.payments || []) as Payment[];
  const activities = [...((r.collection_activities || []) as Activity[])].sort(
    (a, b) => b.activity_at.localeCompare(a.activity_at),
  );
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0),
    remaining = Math.max(0, Number(r.total_amount) - paid);
  const period = relation(r.service_periods) as {
    year?: number;
    month?: number;
    services?: unknown;
  } | null;
  return (
    <>
      <div className="mb-6">
        <div className="text-sm text-slate-500">
          Tahsilat / {relation(r.clients)?.company_name}
        </div>
        <h1 className="mt-1 text-2xl font-bold">
          {relation(r.projects)?.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {relation(period?.services)?.name} ·{" "}
          {period?.month?.toString().padStart(2, "0")}/{period?.year}
        </p>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Summary
          label="Toplam alacak"
          value={formatMoney(r.total_amount, r.currency)}
        />
        <Summary
          label="Tahsil edilen"
          value={formatMoney(paid, r.currency)}
          positive
        />
        <Summary
          label="Kalan bakiye"
          value={formatMoney(remaining, r.currency)}
          danger={remaining > 0}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Parçalı ödeme</h2>
          {remaining > 0 ? (
            <PaymentForm
              receivableId={id}
              maxAmount={remaining}
              accounts={accounts || []}
            />
          ) : (
            <p className="text-sm text-emerald-700">
              Bu alacak tamamen tahsil edildi.
            </p>
          )}
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-3 text-sm font-semibold">Ödeme geçmişi</h3>
            <div className="space-y-3">
              {payments
                .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"
                  >
                    <div>
                      <div>{p.payment_date}</div>
                      <div className="text-xs text-slate-500">
                        {p.notes || "Not yok"}
                      </div>
                    </div>
                    <b>{formatMoney(p.amount, r.currency)}</b>
                  </div>
                ))}
              {!payments.length && (
                <p className="text-sm text-slate-400">Henüz ödeme yok.</p>
              )}
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Tahsilat iletişimi</h2>
          <CollectionActivityForm receivableId={id} />
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-3 text-sm font-semibold">
              Aktivite zaman çizelgesi
            </h3>
            <div className="space-y-3">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="border-l-2 border-[#CD0B16] pl-4 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <b>{activityLabels[a.activity_type]}</b>
                    <span className="text-xs text-slate-400">
                      {new Date(a.activity_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">{a.note || "—"}</p>
                  {a.promised_payment_date && (
                    <p className="mt-1 text-xs text-[#CD0B16]">
                      Söz verilen tarih: {a.promised_payment_date}
                    </p>
                  )}
                </div>
              ))}
              {!activities.length && (
                <p className="text-sm text-slate-400">Henüz aktivite yok.</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function relation(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as {
    company_name?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
  } | null;
}
function Summary({
  label,
  value,
  positive,
  danger,
}: {
  label: string;
  value: string;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-xl font-bold ${positive ? "text-emerald-700" : danger ? "text-[#CD0B16]" : ""}`}
      >
        {value}
      </div>
    </Card>
  );
}
