"use client";
import { useActionState } from "react";
import {
  generateVendorAccruals,
  payVendorAccrual,
} from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
type Account = { id: string; name: string; currency: string };
export function GenerateVendorAccrualsForm({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const [state, action, pending] = useActionState(generateVendorAccruals, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <Button disabled={pending}>
        {pending ? "Oluşturuluyor…" : "Aylık hakedişleri oluştur"}
      </Button>
      <Result state={state} />
    </form>
  );
}
export function VendorPaymentForm({
  accrualId,
  remaining,
  accounts,
}: {
  accrualId: string;
  remaining: number;
  accounts: Account[];
}) {
  const [state, action, pending] = useActionState(payVendorAccrual, null);
  return (
    <form
      action={action}
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
    >
      <input type="hidden" name="accrual_id" value={accrualId} />
      <Field label="Ödeme tutarı">
        <input
          name="amount"
          type="number"
          min="0.01"
          max={remaining}
          step="0.01"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Ödeme kasası">
        <select name="account_id" required className={inputClass}>
          <option value="">Seçin</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
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
          {pending ? "Kaydediliyor…" : "Ödemeyi kaydet"}
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
        <span className="text-sm text-emerald-700">{state.success}</span>
      )}
      {state?.error && (
        <span className="text-sm text-red-600">{state.error}</span>
      )}
    </>
  );
}
