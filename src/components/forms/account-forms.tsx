"use client";
import { useActionState } from "react";
import { createAccount, transferAccounts } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
type Account = { id: string; name: string; currency: string };
export function AccountForm() {
  const [state, action, pending] = useActionState(createAccount, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Kasa adı">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Hesap tipi">
        <select name="account_type" className={inputClass}>
          <option value="bank">Banka</option>
          <option value="cash">Nakit</option>
          <option value="virtual">Sanal</option>
          <option value="credit_card">Kredi kartı</option>
          <option value="other">Diğer</option>
        </select>
      </Field>
      <Field label="Para birimi">
        <select name="currency" className={inputClass}>
          {["TRY", "USD", "EUR", "GBP"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Sınıflandırma">
        <select name="billing_preference" className={inputClass}>
          <option value="invoiced">Resmi / faturalı</option>
          <option value="uninvoiced">Faturasız</option>
        </select>
      </Field>
      <Field label="Başlangıç bakiyesi">
        <input
          name="opening_balance"
          type="number"
          step="0.01"
          defaultValue="0"
          className={inputClass}
        />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kasa oluştur"}
        </Button>
      </div>
    </form>
  );
}
export function TransferForm({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState(transferAccounts, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Kaynak kasa">
        <select name="source" required className={inputClass}>
          <option value="">Seçin</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Hedef kasa">
        <select name="target" required className={inputClass}>
          <option value="">Seçin</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tutar">
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Tarih">
        <input
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </Field>
      <Field label="Açıklama" className="sm:col-span-2">
        <input name="description" required className={inputClass} />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Aktarılıyor…" : "Transfer oluştur"}
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
