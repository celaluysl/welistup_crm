"use client";
import { useActionState, useEffect, useState } from "react";
import { addCollectionActivity, cancelPayment, cancelUnallocatedReceipt, classifyUnallocatedReceipt, recordBulkPayment, recordPayment, updatePayment, updateUnallocatedReceipt } from "@/lib/actions/finance";
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
  const [fullPayment, setFullPayment] = useState(false);
  const numericAmount = Number(amount || 0);
  const excessAmount = Math.max(0, numericAmount - maxAmount);
  useEffect(() => { if (state?.success) onSuccess?.(); }, [state?.success, onSuccess]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="receivable_id" value={receivableId} />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 sm:col-span-2">
        <input
          type="checkbox"
          checked={fullPayment}
          onChange={(event) => {
            const checked = event.target.checked;
            setFullPayment(checked);
            setAmount(checked ? String(maxAmount) : "");
          }}
          className="h-5 w-5 accent-emerald-600"
        />
        Ödemenin tamamı alındı
        <span className="ml-auto text-xs font-medium">
          Kalan tutarın tamamını kullan
        </span>
      </label>
      <Field label="Tahsil edilen tutar">
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          readOnly={fullPayment}
          className={`${inputClass} ${fullPayment ? "bg-slate-100 text-slate-500" : ""}`}
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
          {pending ? "Kaydediliyor…" : excessAmount > 0 ? "Ödemeyi ve fazla bakiyeyi kaydet" : fullPayment ? "Tamamını tahsil et" : "Parçalı ödeme kaydet"}
        </Button>
      </div>
    </form>
  );
}

export function BulkPaymentForm({ receivableIds, maxAmount, accounts, onSuccess }: { receivableIds: string[]; maxAmount: number; accounts: { id: string; name: string; currency: string }[]; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(recordBulkPayment, null);
  const [fullPayment, setFullPayment] = useState(true);
  const [amount, setAmount] = useState(String(maxAmount));
  useEffect(() => { if (state?.success) onSuccess?.(); }, [state?.success, onSuccess]);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="receivable_ids" value={JSON.stringify(receivableIds)} />
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 sm:col-span-2"><input type="checkbox" checked={fullPayment} onChange={(event) => { setFullPayment(event.target.checked); setAmount(event.target.checked ? String(maxAmount) : ""); }} className="h-5 w-5 accent-emerald-600"/>Ödemenin tamamı alındı<span className="ml-auto text-xs font-medium">Tüm hizmetlerin kalanını kullan</span></label>
    <Field label="Tahsil edilen toplam"><input name="amount" type="number" min="0.01" max={maxAmount} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} readOnly={fullPayment} className={`${inputClass} ${fullPayment ? "bg-slate-100 text-slate-500" : ""}`}/></Field>
    <Field label="Ödemenin geldiği kasa"><select name="account_id" required className={inputClass}><option value="">Seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field>
    <Field label="Gerçek ödeme tarihi"><input name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className={inputClass}/></Field>
    <Field label="Not"><input name="notes" placeholder="Aylık toplu müşteri tahsilatı" className={inputClass}/></Field>
    <Result state={state}/><div className="sm:col-span-2"><Button disabled={pending}>{pending ? "Kaydediliyor…" : fullPayment ? "Tamamını tahsil et" : "Toplu ödemeyi kaydet"}</Button></div>
  </form>;
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

export function PaymentEditForm({ payment, maxAmount, accounts, onSuccess, onCancel }: { payment: { id: string; amount: number; paymentDate: string; accountId: string | null; notes: string | null; bulkTransactionId?: string | null }; maxAmount: number; accounts: { id: string; name: string; currency: string }[]; onSuccess: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(updatePayment, null);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelPayment, null);
  useEffect(() => { if (state?.success || cancelState?.success) onSuccess(); }, [state?.success, cancelState?.success, onSuccess]);
  return <>{!payment.bulkTransactionId && <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="payment_id" value={payment.id} />
    <Field label="Tahsil edilen tutar"><input name="amount" type="number" min="0.01" max={maxAmount} step="0.01" required defaultValue={payment.amount} className={inputClass} /></Field>
    <Field label="Ödemenin geldiği kasa"><select name="account_id" required defaultValue={payment.accountId || ""} className={inputClass}><option value="">Seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field>
    <Field label="Gerçek ödeme tarihi"><input name="payment_date" type="date" required defaultValue={payment.paymentDate} className={inputClass} /></Field>
    <Field label="Not"><input name="notes" defaultValue={payment.notes || ""} className={inputClass} /></Field>
    <Result state={state} />
    <div className="flex gap-2 sm:col-span-2"><Button disabled={pending}>{pending ? "Güncelleniyor…" : "Ödemeyi güncelle"}</Button><Button type="button" variant="secondary" onClick={onCancel}>Vazgeç</Button></div>
  </form>}<form action={cancelAction} className="mt-5 grid gap-3 border-t border-red-200 pt-5">
    <input type="hidden" name="payment_id" value={payment.id} />
    <div><b className="text-sm text-red-700">Ödeme aslında gelmediyse</b><p className="mt-1 text-xs text-slate-500">Tahsilatı iptal etmek alacağı yeniden açar ve kasa bakiyesini geri düzeltir.{payment.bulkTransactionId ? " Bu kayıt toplu ödemenin ilgili hizmete ayrılan parçasıdır." : ""}</p></div>
    <Field label="İptal nedeni"><input name="cancellation_reason" required minLength={3} placeholder="Örn. Ödeme yanlışlıkla işlendi" className={inputClass} /></Field>
    {cancelState?.error && <p className="text-sm text-red-600">{cancelState.error}</p>}
    <div><Button type="submit" variant="danger" disabled={cancelling} onClick={(event) => { if (!window.confirm("Bu tahsilatı iptal edip alacağı yeniden açmak istiyor musunuz?")) event.preventDefault(); }}>{cancelling ? "İptal ediliyor…" : "Tahsilatı iptal et"}</Button></div>
  </form></>;
}

export function ReceiptClassificationForm({ receiptId, services, onSuccess, onCancel }: { receiptId: string; services: { id: string; name: string }[]; onSuccess: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(classifyUnallocatedReceipt, null);
  const [serviceId, setServiceId] = useState("");
  useEffect(() => { if (state?.success) onSuccess(); }, [state?.success, onSuccess]);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="receipt_id" value={receiptId}/>
    <Field label="Hizmet"><select name="service_id" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={inputClass}><option value="">Tek seferlik / katalog dışı</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
    <Field label="Tek seferlik hizmet adı"><input name="custom_service_name" disabled={!!serviceId} required={!serviceId} placeholder="Örn. Landing page düzenlemesi" className={`${inputClass} disabled:bg-slate-100`}/></Field>
    <Field label="Eşleştirme notu" className="sm:col-span-2"><input name="notes" placeholder="Satışın kapsamı veya açıklaması" className={inputClass}/></Field>
    <Result state={state}/>
    <div className="flex gap-2 sm:col-span-2"><Button disabled={pending}>{pending ? "Eşleştiriliyor…" : "Hizmetle eşleştir"}</Button><Button type="button" variant="secondary" onClick={onCancel}>Vazgeç</Button></div>
  </form>;
}

export function UnallocatedReceiptEditForm({ receipt, accounts, onSuccess, onCancel }: { receipt: { id: string; amount: number; receivedDate: string; accountId: string | null; notes: string | null }; accounts: { id: string; name: string; currency: string }[]; onSuccess: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(updateUnallocatedReceipt, null);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelUnallocatedReceipt, null);
  useEffect(() => { if (state?.success || cancelState?.success) onSuccess(); }, [state?.success, cancelState?.success, onSuccess]);
  return <><form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="receipt_id" value={receipt.id}/>
    <Field label="Fazla tahsilat tutarı"><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={receipt.amount} className={inputClass}/></Field>
    <Field label="Ödemenin geldiği kasa"><select name="account_id" required defaultValue={receipt.accountId || ""} className={inputClass}><option value="">Seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></Field>
    <Field label="Gerçek ödeme tarihi"><input name="received_date" type="date" required defaultValue={receipt.receivedDate} className={inputClass}/></Field>
    <Field label="Not"><input name="notes" defaultValue={receipt.notes || ""} className={inputClass}/></Field>
    <Result state={state}/>
    <div className="flex gap-2 sm:col-span-2"><Button disabled={pending}>{pending ? "Güncelleniyor…" : "Fazla tahsilatı güncelle"}</Button><Button type="button" variant="secondary" onClick={onCancel}>Vazgeç</Button></div>
  </form><form action={cancelAction} className="mt-5 grid gap-3 border-t border-red-200 pt-5">
    <input type="hidden" name="receipt_id" value={receipt.id}/>
    <div><b className="text-sm text-red-700">Bu para aslında gelmediyse</b><p className="mt-1 text-xs text-slate-500">İptal işlemi fazla tahsilatı kaldırır ve bağlı kasa girişini geri alır.</p></div>
    <Field label="İptal nedeni"><input name="cancellation_reason" required minLength={3} placeholder="Örn. Yanlışlıkla iki kez kaydedildi" className={inputClass}/></Field>
    {cancelState?.error && <p className="text-sm text-red-600">{cancelState.error}</p>}
    <div><Button type="submit" variant="danger" disabled={cancelling} onClick={(event) => { if (!window.confirm("Bu fazla tahsilatı iptal edip kasa girişini geri almak istiyor musunuz?")) event.preventDefault(); }}>{cancelling ? "İptal ediliyor…" : "Fazla tahsilatı iptal et"}</Button></div>
  </form></>;
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
