"use client";
import { Field, inputClass } from "@/components/ui/field";
type Service = {
  id: string;
  name: string;
  default_periodicity: "monthly" | "variable_monthly" | "one_time" | "periodic";
};
type InitialService = {
  service_id: string;
  periodicity: "monthly" | "variable_monthly" | "one_time" | "periodic";
  net_price: number;
  vat_rate: number;
  currency: "TRY" | "USD" | "EUR" | "GBP";
  payment_term_days: number;
  notes: string | null;
};
export function ProjectServiceRows({
  services,
  initialService,
  isUninvoiced = false,
}: {
  services: Service[];
  initialService?: InitialService;
  isUninvoiced?: boolean;
}) {
  return (
    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-4">
        <h3 className="font-semibold">Proje hizmeti</h3>
        <p className="mt-1 text-xs text-slate-500">
          Her proje yalnızca bir hizmete bağlıdır. Hizmetin fiyat ve ödeme
          bilgilerini girin.
        </p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Hizmet" className="xl:col-span-2">
            <select
              name="service_id"
              required
              defaultValue={initialService?.service_id || ""}
              className={inputClass}
            >
              <option value="">Seçin</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dönem">
            <select
              name="service_periodicity"
              defaultValue={initialService?.periodicity || "monthly"}
              className={inputClass}
            >
              <option value="monthly">Aylık</option>
              <option value="variable_monthly">Değişken aylık</option>
              <option value="one_time">Tek seferlik</option>
              <option value="periodic">Dönemsel</option>
            </select>
          </Field>
          <Field label="Net fiyat">
            <input
              name="service_net_price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initialService?.net_price}
              required
              className={inputClass}
            />
          </Field>
          <Field label={isUninvoiced ? "KDV (%) · Faturasız" : "KDV (%)"}>
            {isUninvoiced && (
              <input type="hidden" name="service_vat_rate" value="0" />
            )}
            <input
              key={isUninvoiced ? "vat-disabled" : "vat-enabled"}
              name={isUninvoiced ? undefined : "service_vat_rate"}
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={isUninvoiced ? 0 : (initialService?.vat_rate ?? 20)}
              disabled={isUninvoiced}
              required
              className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </Field>
          <Field label="Para birimi">
            <select
              name="service_currency"
              defaultValue={initialService?.currency || "TRY"}
              className={inputClass}
            >
              {["TRY", "USD", "EUR", "GBP"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Ödeme vadesi (gün)">
            <input
              name="service_payment_term_days"
              type="number"
              min="0"
              defaultValue={initialService?.payment_term_days ?? 0}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Hizmet notu" className="md:col-span-2 xl:col-span-5">
            <input
              name="service_notes"
              defaultValue={initialService?.notes || ""}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
