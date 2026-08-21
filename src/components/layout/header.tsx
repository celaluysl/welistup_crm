import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
export async function Header() {
  const s = await createClient();
  const [
    {
      data: { user },
    },
    { count },
  ] = await Promise.all([
    s.auth.getUser(),
    s
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
  ]);
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur print:hidden lg:px-8">
      <form
        action="/search"
        className="relative hidden w-full max-w-md md:block"
      >
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          name="q"
          aria-label="Global arama"
          placeholder="Müşteri, proje, teklif veya görev ara…"
          className="h-10 w-full rounded-lg bg-slate-100 pl-10 pr-3 text-sm focus:ring-2 focus:ring-red-100"
        />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/notifications"
          aria-label="Bildirimler"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <Bell size={19} />
          {Boolean(count) && (
            <span className="absolute right-0 top-0 min-w-4 rounded-full bg-[#CD0B16] px-1 text-center text-[10px] leading-4 text-white">
              {count! > 99 ? "99+" : count}
            </span>
          )}
        </Link>
        <div className="hidden text-right sm:block">
          <div className="max-w-48 truncate text-sm font-medium">
            {user?.email}
          </div>
          <div className="text-xs text-slate-500">Welistup ekibi</div>
        </div>
        <form action={logout}>
          <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
            Çıkış
          </button>
        </form>
      </div>
    </header>
  );
}
