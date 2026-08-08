import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  refreshNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
export default async function Notifications() {
  const s = await createClient();
  const { data, error } = await s
    .from("notifications")
    .select("id,title,body,href,is_read,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <PageHeader
        title="Bildirimler"
        description="Görev, tahsilat, tedarikçi ödemesi ve teklif son tarihleri."
      />
      <div className="mb-5 flex gap-2">
        <form action={refreshNotifications}>
          <button className="h-10 rounded-lg bg-[#CD0B16] px-4 text-sm font-semibold text-white">
            Bildirimleri güncelle
          </button>
        </form>
        <form action={markAllNotificationsRead}>
          <button className="h-10 rounded-lg border px-4 text-sm font-semibold">
            Tümünü okundu işaretle
          </button>
        </form>
      </div>
      <Card className="divide-y overflow-hidden">
        {data?.map((n) => (
          <div
            key={n.id}
            className={`flex gap-4 px-5 py-4 ${n.is_read ? "" : "bg-red-50/40"}`}
          >
            <Link href={n.href || "#"} className="min-w-0 flex-1">
              <div className="font-semibold">{n.title}</div>
              <div className="mt-1 text-sm text-slate-500">{n.body || "—"}</div>
              <time className="mt-2 block text-xs text-slate-400">
                {new Date(n.created_at).toLocaleString("tr-TR")}
              </time>
            </Link>
            {!n.is_read && (
              <form action={markNotificationRead.bind(null, n.id)}>
                <button className="text-xs font-semibold text-[#CD0B16]">
                  Okundu
                </button>
              </form>
            )}
          </div>
        ))}
        {(!data?.length || error) && (
          <div className="p-10 text-center text-sm text-slate-500">
            {error
              ? "Bildirimler yüklenemedi."
              : "Henüz bildirim yok. Güncelle butonuyla kontrol edebilirsiniz."}
          </div>
        )}
      </Card>
    </>
  );
}
