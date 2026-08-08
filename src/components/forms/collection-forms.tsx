"use client";
import { useActionState } from "react";
import { addCollectionActivity, recordPayment } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export function PaymentForm({
  receivableId,
  maxAmount,
  accounts,
}: {
  receivableId: string;
  maxAmount: number;
  accounts: { id: string; name: string; currency: string }[];
}) {
  const [state, action, pending] = useActionState(recordPayment, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="receivable_id" value={receivableId} />
      <Field label="Tahsil edilen tutar">
        <input
          name="amount"
          type="number"
          min="0.01"
          max={maxAmount}
          step="0.01"
          required
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
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Parçalı ödeme kaydet"}
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
