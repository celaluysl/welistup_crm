import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
const labels: Record<string, string> = {
  freelancer: "Freelancer",
  agency: "Ajans",
  company: "Şirket",
  developer: "Yazılımcı",
  designer: "Tasarımcı",
  content_creator: "İçerik üreticisi",
  other: "Diğer",
};
export default async function Vendors() {
  const s = await createClient();
  const { data, error } = await s
    .from("vendors")
    .select("id,name,vendor_type,phone,email,status,vendor_assignments(count)")
    .neq("status", "archived")
    .order("name");
  return (
    <>
      <PageHeader
        title="Tedarikçiler"
        description="Freelancer, ajans ve diğer hizmet sağlayıcılarını yönetin."
        action={{ label: "Yeni tedarikçi", href: "/vendors/new" }}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.map((v) => (
          <Link key={v.id} href={`/vendors/${v.id}`}>
            <Card className="p-5 transition hover:border-[#CD0B16]">
              <div className="flex justify-between">
                <div>
                  <h2 className="font-semibold">{v.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {labels[v.vendor_type]} ·{" "}
                    {v.email || v.phone || "İletişim bilgisi yok"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                  {v.status === "active" ? "Aktif" : "Pasif"}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {(!data?.length || error) && (
        <Card className="p-10 text-center text-sm text-slate-500">
          {error ? "Tedarikçiler yüklenemedi." : "Henüz tedarikçi yok."}
        </Card>
      )}
    </>
  );
}
