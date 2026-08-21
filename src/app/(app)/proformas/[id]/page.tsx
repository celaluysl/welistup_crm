import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { companyProfile } from "@/lib/company-profile";
import { PrintButton } from "@/components/ui/print-button";
export default async function ProformaDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const { data: p } = await s
    .from("proformas")
    .select("*,clients(*),proforma_items(*)")
    .eq("id", id)
    .single();
  if (!p) notFound();
  return (
    <>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[12mm] text-slate-900 shadow-sm [print-color-adjust:exact] print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-[#CD0B16] pb-5">
          <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2 print:grid-cols-2">
            <Image
              src="/logo.svg"
              alt="Welistup"
              width={170}
              height={53}
              priority
              unoptimized
              className="h-auto w-[170px]"
            />
            <div className="text-left sm:text-right print:text-right">
              <h1 className="text-2xl font-bold text-[#CD0B16]">
                PROFORMA FATURA
              </h1>
              <p className="mt-1 text-xs font-bold">MALİ BELGE DEĞİLDİR</p>
              <p className="mt-2 text-sm font-semibold">{p.proforma_number}</p>
            </div>

            <div className="text-sm">
              <div className="text-base font-semibold">
                {companyProfile.legalName}
              </div>
              <address className="mt-2 whitespace-pre-line not-italic leading-5 text-slate-600">
                {companyProfile.address}
              </address>
              <div className="mt-2 leading-5 text-slate-600">
                {companyProfile.taxOffice} Vergi Dairesi
                <br />
                VKN {companyProfile.taxNumber}
              </div>
            </div>

            <div className="text-sm">
              <div className="text-base font-semibold">
                {p.customer_legal_name ||
                  p.customer_name ||
                  p.clients?.legal_name ||
                  p.clients?.company_name}
              </div>
              {(p.customer_address || p.clients?.address) && (
                <div className="mt-2 whitespace-pre-line leading-5 text-slate-600">
                  {p.customer_address || p.clients?.address}
                </div>
              )}
              {(p.customer_tax_office ||
                p.clients?.tax_office ||
                p.customer_tax_number ||
                p.clients?.tax_number) && (
                <div className="mt-2 leading-5 text-slate-600">
                  {p.customer_tax_office || p.clients?.tax_office || "—"}
                  <br />
                  VKN {p.customer_tax_number || p.clients?.tax_number || "—"}
                </div>
              )}
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 border-t border-slate-300 pt-3">
                <dt className="text-slate-400">Tarih</dt>
                <dd className="text-right font-medium">{p.issue_date}</dd>
                <dt className="text-slate-400">Geçerlilik</dt>
                <dd className="text-right font-medium">
                  {p.valid_until || "—"}
                </dd>
                <dt className="text-slate-400">Para birimi</dt>
                <dd className="text-right font-medium">{p.currency}</dd>
              </dl>
            </div>
          </div>
        </header>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase">
              <th className="px-3 py-2.5">Hizmet / Açıklama</th>
              <th className="px-3 py-2.5 text-right">Miktar</th>
              <th className="px-3 py-2.5 text-right">Birim</th>
              <th className="px-3 py-2.5 text-right">KDV</th>
              <th className="px-3 py-2.5 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {p.proforma_items.map(
              (x: {
                id: string;
                service_name: string | null;
                description: string;
                quantity: number;
                unit_price: number;
                vat_rate: number;
                line_total: number;
              }) => (
                <tr key={x.id} className="border-b">
                  <td className="px-3 py-3">
                    <div className="font-medium">{x.service_name}</div>
                    <div className="text-xs text-slate-500">
                      {x.description}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">{x.quantity}</td>
                  <td className="px-3 py-3 text-right">
                    {formatMoney(x.unit_price, p.currency)}
                  </td>
                  <td className="px-3 py-3 text-right">%{x.vat_rate}</td>
                  <td className="px-3 py-3 text-right font-medium">
                    {formatMoney(x.line_total, p.currency)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <section
          className={`mt-5 grid items-start gap-6 ${
            p.description
              ? "sm:grid-cols-[minmax(0,1fr)_18rem] print:grid-cols-[minmax(0,1fr)_18rem]"
              : ""
          }`}
        >
          {p.description && (
            <div className="rounded-lg bg-slate-50 p-3.5 text-sm">
              <h2 className="font-semibold">Genel açıklama</h2>
              <p className="mt-2 whitespace-pre-wrap break-words leading-6 text-slate-600">
                {p.description}
              </p>
            </div>
          )}
          <div
            className={`w-full max-w-72 space-y-2 text-sm ${
              p.description ? "" : "ml-auto"
            }`}
          >
            <Row
              label="Ara toplam"
              value={formatMoney(p.subtotal, p.currency)}
            />
            <Row
              label="İndirim"
              value={formatMoney(p.total_discount, p.currency)}
            />
            <Row label="KDV" value={formatMoney(p.total_vat, p.currency)} />
            <div className="flex justify-between border-t-2 border-[#CD0B16] pt-3 text-lg font-bold">
              <span>Genel toplam</span>
              <span>{formatMoney(p.grand_total, p.currency)}</span>
            </div>
          </div>
        </section>
        {p.payment_terms && (
          <section className="mt-4 rounded-lg bg-slate-50 p-3.5 text-sm">
            <h2 className="font-semibold">Ödeme koşulları</h2>
            <p className="mt-2 whitespace-pre-wrap break-words leading-6 text-slate-600">
              {p.payment_terms}
            </p>
          </section>
        )}
        {p.bank_details && (
          <section className="mt-4 rounded-lg bg-slate-50 p-3.5 text-sm">
            <h2 className="font-semibold">Banka bilgileri</h2>
            <p className="mt-2 whitespace-pre-line text-slate-600">
              {p.bank_details}
            </p>
          </section>
        )}
        <footer className="mt-7 border-t pt-3 text-center text-[10px] text-slate-400">
          Bu belge yalnızca bilgilendirme amaçlı proformadır ve mali belge
          niteliği taşımaz.
        </footer>
      </article>
    </>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
