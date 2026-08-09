"use client";
import { useActionState, useEffect, useState } from "react";
import { addCollectionActivity, recordPayment, updatePayment } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function PaymentForm({
  receivableId,
  maxAmount,
  accounts,
  onSuccess,
}: {
  receivableId: string;
  maxAmount: number;
  accounts: { id: string; name: string; currency: string }[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(recordPayment, null);
  const [amount, setAmount] = useState("");
  const numericAmount = Number(amount || 0);
  const excessAmount = Math.max(0, numericAmount - maxAmount);
  useEffect(() => { if (state?.success) onSuccess?.(); }, [state?.success, onSuccess]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="receivable_id" value={receivableId} />
      <Field label="Tahsil edilen tutar">
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Ödemenin geldiği kasa">
        <select name="account_id" required className={inputClass}>
          <option value="">Seçin</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Gerçek ödeme tarihi">
        <input
          name="payment_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </Field>
      <Field label="Not">
        <input name="notes" className={inputClass} />
      </Field>
      {excessAmount > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
        <b>{excessAmount.toLocaleString("tr-TR", { style: "currency", currency: accounts[0]?.currency || "TRY" })} fazla ödeme var.</b>
        <p className="mt-1 text-xs text-amber-700">Kalan alacak kapatılacak; fazla tutar, hizmeti henüz belirlenmemiş müşteri bakiyesi olarak kasaya kaydedilecek.</p>
        <label className="mt-3 flex items-start gap-2 font-medium"><input type="checkbox" name="allow_excess" value="true" required className="mt-0.5"/>Fazla tahsilatı açıklanamayan müşteri bakiyesi olarak kaydet</label>
      </div>}
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : excessAmount > 0 ? "Ödemeyi ve fazla bakiyeyi kaydet" : "Parçalı ödeme kaydet"}
        </Button>
      </div>
    </form>
  );
}

export function CollectionActivityForm({
  receivableId,
}: {
  receivableId: string;
}) {
  const [state, action, pending] = useActionState(addCollectionActivity, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="receivable_id" value={receivableId} />
      <Field label="İletişim türü">
        <select name="activity_type" className={inputClass}>
          <option value="call">Telefon</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">E-posta</option>
          <option value="promise">Ödeme sözü</option>
          <option value="note">Not</option>
        </select>
      </Field>
      <Field label="Söz verilen ödeme tarihi">
        <input
          name="promised_payment_date"
          type="date"
          className={inputClass}
        />
      </Field>
      <Field label="Görüşme notu" className="sm:col-span-2">
        <textarea
          name="note"
          required
          rows={3}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button variant="secondary" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Aktivite ekle"}
        </Button>
      </div>
    </form>
  );
}

export function PaymentEditForm({ payment, maxAmount, accounts, onSuccess, onCancel }: { payment: { id: string; amount: number; paymentDate: string; accountId: string | null; notes: string | null }; maxAmount: number; accounts: { id: string; name: string; currency: string }[]; onSuccess: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(updatePayment, null);
  useEffect(() => { if (state?.success) onSuccess(); }, [state?.success, onSuccess]);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="payment_id" value={payment.id} />
    <Field label="Tahsil edilen tutar"><input name="amount" type="number" min="0.01" max={maxAmount} step="0.01" required defaultValue={payment.amount} className={inputClass} /></Field>
    <Field label="Ödemenin geldiği kasa"><select name="account_id" required defaultValue={payment.accountId || ""} className={inputClass}><option value="">Seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field>
    <Field label="Gerçek ödeme tarihi"><input name="payment_date" type="date" required defaultValue={payment.paymentDate} className={inputClass} /></Field>
    <Field label="Not"><input name="notes" defaultValue={payment.notes || ""} className={inputClass} /></Field>
    <Result state={state} />
    <div className="flex gap-2 sm:col-span-2"><Button disabled={pending}>{pending ? "Güncelleniyor…" : "Ödemeyi güncelle"}</Button><Button type="button" variant="secondary" onClick={onCancel}>Vazgeç</Button></div>
  </form>;
}

function Result({
  state,
}: {
  state: { error?: string; success?: string } | null;
}) {
  return (
    <>
      {state?.success && (
        <p className="sm:col-span-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      {state?.error && (
        <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
      )}
    </>
  );
}
