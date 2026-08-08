"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { createStandaloneProforma } from "@/lib/actions/offers";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";

type Item = { service_id: string; service_name: string; description: string; quantity: number; unit_price: number; discount_rate: number; vat_rate: number };
type Values = { client_id: string; issue_date: string; valid_until: string; currency: "TRY" | "USD" | "EUR" | "GBP"; bank_details: string; description: string; payment_terms: string; items: Item[] };
const emptyItem: Item = { service_id: "", service_name: "", description: "", quantity: 1, unit_price: 0, discount_rate: 0, vat_rate: 20 };

export function StandaloneProformaForm({ clients, services }: { clients: { id: string; company_name: string }[]; services: { id: string; name: string }[] }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const { register, control, handleSubmit, watch, setValue } = useForm<Values>({ defaultValues: { client_id: "", issue_date: new Date().toISOString().slice(0, 10), valid_until: "", currency: "TRY", bank_details: "", description: "", payment_terms: "", items: [{ ...emptyItem }] } });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  // eslint-disable-next-line react-hooks/incompatible-library
  const values = watch();
  const total = values.items.reduce((sum, item) => { const net = Number(item.quantity || 0) * Number(item.unit_price || 0) * (1 - Number(item.discount_rate || 0) / 100); return sum + net * (1 + Number(item.vat_rate || 0) / 100); }, 0);
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name || "";
  const isOther = (id: string) => serviceName(id).trim().toLocaleLowerCase("tr-TR") === "diğer";

  return <form onSubmit={handleSubmit((value) => start(async () => { setError(""); const result = await createStandaloneProforma(value); if (result?.error) setError(result.error); }))} className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Müşteri"><select required {...register("client_id")} className={inputClass}><option value="">Müşteri seçin</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
      <Field label="Para birimi"><select {...register("currency")} className={inputClass}>{(["TRY", "USD", "EUR", "GBP"] as const).map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
      <Field label="Proforma tarihi"><input required type="date" {...register("issue_date")} className={inputClass} /></Field>
      <Field label="Geçerlilik tarihi"><input type="date" {...register("valid_until")} className={inputClass} /></Field>
    </div>

    <div>
      <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Proforma satırları</h2><p className="mt-1 text-xs text-slate-500">Hizmet, kapsam, fiyat, indirim ve KDV bilgilerini girin.</p></div><Button type="button" variant="secondary" onClick={() => append({ ...emptyItem })}><Plus size={16} /> Satır ekle</Button></div>
      <div className="space-y-3">{fields.map((field, index) => {
        const selectedId = values.items[index]?.service_id || "";
        const custom = isOther(selectedId);
        const serviceRegistration = register(`items.${index}.service_id`);
        return <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="grid items-end gap-3 lg:grid-cols-[190px_minmax(180px,.8fr)_minmax(240px,1.2fr)_90px_140px_110px_100px_40px]">
            <Field label="Hizmet"><select {...serviceRegistration} onChange={(event) => { serviceRegistration.onChange(event); const name = serviceName(event.target.value); setValue(`items.${index}.service_name`, isOther(event.target.value) ? "" : name); }} className={inputClass}><option value="">Hizmet seçin</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
            <Field label={custom ? "Tek seferlik hizmet adı" : "Proformada görünecek ad"}><input required placeholder={custom ? "Özel hizmet adını yazın" : "Hizmet adı"} {...register(`items.${index}.service_name`)} className={inputClass} /></Field>
            <Field label="Hizmet açıklaması"><input required placeholder="Yapılacak işin kapsamı" {...register(`items.${index}.description`)} className={inputClass} /></Field>
            <Field label="Adet"><input type="number" min="0.01" step=".01" {...register(`items.${index}.quantity`, { valueAsNumber: true })} className={inputClass} /></Field>
            <Field label="Birim fiyat"><input type="number" min="0" step=".01" {...register(`items.${index}.unit_price`, { valueAsNumber: true })} className={inputClass} /></Field>
            <Field label="İndirim (%)"><input type="number" min="0" max="100" step=".01" {...register(`items.${index}.discount_rate`, { valueAsNumber: true })} className={inputClass} /></Field>
            <Field label="KDV (%)"><input type="number" min="0" max="100" step=".01" {...register(`items.${index}.vat_rate`, { valueAsNumber: true })} className={inputClass} /></Field>
            <button type="button" aria-label="Proforma satırını sil" onClick={() => remove(index)} className="flex size-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={17} /></button>
          </div>
        </div>;
      })}</div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Genel açıklama"><textarea rows={3} {...register("description")} className={`${inputClass} h-auto py-2`} /></Field>
      <Field label="Ödeme koşulları"><textarea rows={3} {...register("payment_terms")} className={`${inputClass} h-auto py-2`} /></Field>
      <Field label="Banka bilgileri" className="sm:col-span-2"><textarea rows={4} {...register("bank_details")} className={`${inputClass} h-auto py-2`} placeholder="Banka, IBAN ve hesap sahibi" /></Field>
    </div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex items-center justify-between border-t pt-5"><div><div className="text-xs text-slate-400">Genel toplam</div><div className="text-2xl font-bold">{formatMoney(total, values.currency)}</div></div><Button disabled={pending}>{pending ? "Oluşturuluyor…" : "Proforma oluştur"}</Button></div>
  </form>;
}
