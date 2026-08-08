import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
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
      <article className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[16mm] text-slate-900 shadow-sm print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-[#CD0B16] pb-6">
          <Image src="/logo.svg" alt="Welistup" width={170} height={53} />
          <div className="text-right">
            <h1 className="text-2xl font-bold text-[#CD0B16]">
              PROFORMA FATURA
            </h1>
            <p className="mt-1 text-xs font-bold">MALİ BELGE DEĞİLDİR</p>
            <p className="mt-4 text-sm font-semibold">{p.proforma_number}</p>
          </div>
        </header>
        <section className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">
              Müşteri
            </div>
            <div className="mt-2 text-lg font-semibold">
              {p.clients.company_name}
            </div>
            <div className="mt-1 whitespace-pre-line text-slate-500">
              {p.clients.address}
            </div>
            <div className="mt-1 text-slate-500">
              {p.clients.tax_office} {p.clients.tax_number}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-right">
            <dt className="text-slate-400">Tarih</dt>
            <dd>{p.issue_date}</dd>
            <dt className="text-slate-400">Geçerlilik</dt>
            <dd>{p.valid_until || "—"}</dd>
            <dt className="text-slate-400">Para birimi</dt>
            <dd>{p.currency}</dd>
          </dl>
        </section>
        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase">
              <th className="px-3 py-3">Hizmet / Açıklama</th>
              <th className="px-3 py-3 text-right">Miktar</th>
              <th className="px-3 py-3 text-right">Birim</th>
              <th className="px-3 py-3 text-right">KDV</th>
              <th className="px-3 py-3 text-right">Toplam</th>
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
                  <td className="px-3 py-4">
                    <div className="font-medium">{x.service_name}</div>
                    <div className="text-xs text-slate-500">
                      {x.description}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right">{x.quantity}</td>
                  <td className="px-3 py-4 text-right">
                    {formatMoney(x.unit_price, p.currency)}
                  </td>
                  <td className="px-3 py-4 text-right">%{x.vat_rate}</td>
                  <td className="px-3 py-4 text-right font-medium">
                    {formatMoney(x.line_total, p.currency)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <section className="ml-auto mt-6 w-72 space-y-2 text-sm">
          <Row label="Ara toplam" value={formatMoney(p.subtotal, p.currency)} />
          <Row
            label="İndirim"
            value={formatMoney(p.total_discount, p.currency)}
          />
          <Row label="KDV" value={formatMoney(p.total_vat, p.currency)} />
          <div className="flex justify-between border-t-2 border-[#CD0B16] pt-3 text-lg font-bold">
            <span>Genel toplam</span>
            <span>{formatMoney(p.grand_total, p.currency)}</span>
          </div>
        </section>
        {p.bank_details && (
          <section className="mt-10 rounded-lg bg-slate-50 p-4 text-sm">
            <h2 className="font-semibold">Banka bilgileri</h2>
            <p className="mt-2 whitespace-pre-line text-slate-600">
              {p.bank_details}
            </p>
          </section>
        )}
        <footer className="mt-12 border-t pt-4 text-center text-[10px] text-slate-400">
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
