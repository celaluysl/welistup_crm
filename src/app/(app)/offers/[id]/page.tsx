import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { setOfferStatus } from "@/lib/actions/offers";
const labels: Record<string, string> = {
  draft: "Taslak",
  ready: "Hazır",
  sent: "Gönderildi",
  revising: "Revize Ediliyor",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  expired: "Süresi Doldu",
};
type OfferStatus =
  "draft" | "ready" | "sent" | "revising" | "accepted" | "rejected" | "expired";
export default async function OfferDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await createClient();
  const { data: o } = await s
    .from("offers")
    .select(
      "*,clients(company_name),leads(company_name),offer_revisions(*,offer_revision_items(*,services(name)))",
    )
    .eq("id", id)
    .single();
  if (!o) notFound();
  const revisions = [...o.offer_revisions].sort(
    (a, b) => b.revision_number - a.revision_number,
  );
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">
            Teklifler / {o.offer_number}
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            {(o.clients as unknown as { company_name: string })?.company_name ||
              (o.leads as unknown as { company_name: string })?.company_name}
          </h1>
        </div>
        <div className="flex gap-2">
          <form
            action={async (fd) => {
              "use server";
              await setOfferStatus(id, String(fd.get("status")) as OfferStatus);
            }}
          >
            <select
              name="status"
              defaultValue={o.status}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              onChange={undefined}
            >
              {Object.entries(labels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button className="ml-2 h-10 rounded-lg border px-3 text-sm font-semibold">
              Durumu kaydet
            </button>
          </form>
          <Link
            href={`/offers/${id}/revise`}
            className="inline-flex h-10 items-center rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white"
          >
            Revize et
          </Link>
          {o.client_id && (
            <Link
              href={`/offers/${id}/proforma`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold"
            >
              Proforma
            </Link>
          )}
          {o.client_id && (
            <Link
              href={`/offers/${id}/convert`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold"
            >
              Projeye dönüştür
            </Link>
          )}
        </div>
      </div>
      <div className="space-y-5">
        {revisions.map((r) => (
          <Card key={r.id} className="p-6">
            <div className="flex justify-between">
              <div>
                <h2 className="font-semibold">Revizyon {r.revision_number}</h2>
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(r.created_at).toLocaleString("tr-TR")}
                </div>
              </div>
              <div className="text-xl font-bold">
                {formatMoney(r.grand_total, o.currency)}
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400">
                  <tr>
                    <th className="py-2">Hizmet</th>
                    <th>Açıklama</th>
                    <th>Miktar</th>
                    <th>Birim</th>
                    <th>Net</th>
                    <th>KDV</th>
                    <th>Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {r.offer_revision_items.map(
                    (x: {
                      id: string;
                      services: { name: string } | null;
                      custom_service_name: string | null;
                      description: string;
                      quantity: number;
                      unit_price: number;
                      line_net: number;
                      line_vat: number;
                      line_total: number;
                    }) => (
                      <tr key={x.id} className="border-t">
                        <td className="py-3">{x.custom_service_name || x.services?.name || "—"}</td>
                        <td>{x.description}</td>
                        <td>{x.quantity}</td>
                        <td>{formatMoney(x.unit_price, o.currency)}</td>
                        <td>{formatMoney(x.line_net, o.currency)}</td>
                        <td>{formatMoney(x.line_vat, o.currency)}</td>
                        <td className="font-medium">
                          {formatMoney(x.line_total, o.currency)}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {r.payment_terms && (
              <p className="mt-5 border-t pt-4 text-sm text-slate-500">
                <b>Ödeme:</b> {r.payment_terms}
              </p>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
