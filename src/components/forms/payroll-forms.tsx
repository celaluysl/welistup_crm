"use client";
import { useActionState } from "react";
import {
  createSalaryConfig,
  generatePayroll,
  payPayroll,
} from "@/lib/actions/payroll";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
type Account = { id: string; name: string; currency: string };
type Profile = { id: string; name: string };
export function SalaryConfigForm({ profiles }: { profiles: Profile[] }) {
  const [state, action, pending] = useActionState(createSalaryConfig, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Çalışan / ortak">
        <select name="profile_id" required className={inputClass}>
          <option value="">Seçin</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sabit aylık maaş">
        <input
          name="base_salary"
          type="number"
          min="0"
          step="0.01"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Para birimi">
        <select name="currency" className={inputClass}>
          {["TRY", "USD", "EUR", "GBP"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Geçerlilik başlangıcı">
        <input
          name="effective_from"
          type="date"
          required
          className={inputClass}
        />
      </Field>
      <Result state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>Maaş dönemini ekle</Button>
      </div>
    </form>
  );
}
export function GeneratePayrollForm({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const [state, action, pending] = useActionState(generatePayroll, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <Button disabled={pending}>
        {pending ? "Oluşturuluyor…" : "Maaş kayıtlarını oluştur"}
      </Button>
      <Result state={state} />
    </form>
  );
}
export function PayrollPaymentForm({
  payrollId,
  remaining,
  accounts,
}: {
  payrollId: string;
  remaining: number;
  accounts: Account[];
}) {
  const [state, action, pending] = useActionState(payPayroll, null);
  return (
    <form
      action={action}
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
    >
      <input type="hidden" name="payroll_id" value={payrollId} />
      <Field label="Tutar">
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
      <Field label="Kasa">
        <select name="account_id" required className={inputClass}>
          <option value="">Seçin</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ödeme tarihi">
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
        <Button disabled={pending}>Ödemeyi kaydet</Button>
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
