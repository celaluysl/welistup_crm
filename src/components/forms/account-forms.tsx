"use client";
import { useActionState, useEffect } from "react";
import {
  createAccount,
  createManualAccountMovement,
  transferAccounts,
  updateAccount,
} from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export type AccountOption = {
  id: string;
  name: string;
  currency: string;
  account_type?: string;
  billing_preference?: string;
  opening_balance?: number;
  status?: string;
};
export function AccountForm({
  account,
  onSuccess,
}: {
  account?: AccountOption;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(
    account ? updateAccount : createAccount,
    null,
  );
  useClose(state?.success, onSuccess);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {account && <input type="hidden" name="account_id" value={account.id} />}
      <Field label="Kasa adı">
        <input
          name="name"
          required
          defaultValue={account?.name || ""}
          className={inputClass}
        />
      </Field>
      <Field label="Hesap tipi">
        <select
          name="account_type"
          defaultValue={account?.account_type || "bank"}
          className={inputClass}
        >
          <option value="bank">Banka</option>
          <option value="cash">Nakit</option>
          <option value="virtual">Sanal</option>
          <option value="credit_card">Kredi kartı</option>
          <option value="other">Diğer</option>
        </select>
      </Field>
      <Field label="Para birimi">
        <select
          name="currency"
          defaultValue={account?.currency || "TRY"}
          className={inputClass}
        >
          {["TRY", "USD", "EUR", "GBP"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </Field>
      <Field label="Sınıflandırma">
        <select
          name="billing_preference"
          defaultValue={account?.billing_preference || "invoiced"}
          className={inputClass}
        >
          <option value="invoiced">Resmi / faturalı</option>
          <option value="uninvoiced">Faturasız</option>
        </select>
      </Field>
      <Field label="Başlangıç / sabit bakiye">
        <input
          name="opening_balance"
          type="number"
          step="0.01"
          defaultValue={account?.opening_balance ?? 0}
          className={inputClass}
        />
      </Field>
      {account && (
        <Field label="Durum">
          <select
            name="status"
            defaultValue={account.status || "active"}
            className={inputClass}
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </Field>
      )}
      <Result state={state} />
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending
            ? "Kaydediliyor…"
            : account
              ? "Kasayı güncelle"
              : "Kasa oluştur"}
        </Button>
      </div>
    </form>
  );
}
export function TransferForm({
  accounts,
  onSuccess,
}: {
  accounts: AccountOption[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(transferAccounts, null);
  useClose(state?.success, onSuccess);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <AccountSelect name="source" label="Kaynak kasa" accounts={accounts} />
      <AccountSelect name="target" label="Hedef kasa" accounts={accounts} />
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
      <DateField />
      <Field label="Açıklama" className="sm:col-span-2">
        <input name="description" required className={inputClass} />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending ? "Aktarılıyor…" : "Transfer oluştur"}
        </Button>
      </div>
    </form>
  );
}
export function ManualMovementForm({
  accounts,
  type,
  onSuccess,
}: {
  accounts: AccountOption[];
  type: "income" | "expense";
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(
    createManualAccountMovement,
    null,
  );
  useClose(state?.success, onSuccess);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="movement_type" value={type} />
      <AccountSelect name="account_id" label="Kasa" accounts={accounts} />
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
      <DateField />
      <Field label="Açıklama">
        <input
          name="description"
          required
          placeholder={
            type === "income" ? "Para giriş nedeni" : "Gider / çıkış nedeni"
          }
          className={inputClass}
        />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2 flex justify-end">
        <Button disabled={pending}>
          {pending
            ? "Kaydediliyor…"
            : type === "income"
              ? "Para girişini kaydet"
              : "Para çıkışını kaydet"}
        </Button>
      </div>
    </form>
  );
}
function AccountSelect({
  name,
  label,
  accounts,
}: {
  name: string;
  label: string;
  accounts: AccountOption[];
}) {
  return (
    <Field label={label}>
      <select name={name} required className={inputClass}>
        <option value="">Seçin</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {account.currency}
          </option>
        ))}
      </select>
    </Field>
  );
}
function DateField() {
  return (
    <Field label="Tarih">
      <input
        name="date"
        type="date"
        required
        defaultValue={new Date().toISOString().slice(0, 10)}
        className={inputClass}
      />
    </Field>
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
function useClose(
  success: string | undefined,
  onSuccess: (() => void) | undefined,
) {
  useEffect(() => {
    if (success) onSuccess?.();
  }, [success, onSuccess]);
}
