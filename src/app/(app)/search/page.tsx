import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
type Result = {
  category: string;
  entity_id: string;
  title: string;
  subtitle: string;
  href: string;
};
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() || "",
    s = await createClient();
  const { data, error } =
    q.length >= 2
      ? await s.rpc("global_search", { p_query: q, p_limit: 40 })
      : { data: [], error: null };
  const grouped = Object.groupBy((data || []) as Result[], (x) => x.category);
  return (
    <>
      <PageHeader
        title="Global Arama"
        description="Sonuçlar yalnızca erişim yetkiniz bulunan kayıtlardan gelir."
      />
      <Card className="mb-6 p-5">
        <form className="relative max-w-2xl">
          <Search
            className="absolute left-3 top-2.5 text-slate-400"
            size={18}
          />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="En az 2 karakter yazın…"
            className="h-10 w-full rounded-lg border pl-10 pr-3 text-sm"
          />
        </form>
      </Card>
      {error && (
        <Card className="p-8 text-center text-sm text-red-600">
          Arama yapılamadı.
        </Card>
      )}
      {Object.entries(grouped).map(([category, rows]) => (
        <section key={category} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {category}
          </h2>
          <Card className="divide-y overflow-hidden">
            {rows?.map((r) => (
              <Link
                key={`${r.category}-${r.entity_id}`}
                href={r.href}
                className="block px-5 py-4 hover:bg-slate-50"
              >
                <div className="font-semibold">{r.title}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {r.subtitle || "—"}
                </div>
              </Link>
            ))}
          </Card>
        </section>
      ))}
      {q.length >= 2 && !data?.length && !error && (
        <Card className="p-10 text-center text-sm text-slate-500">
          Sonuç bulunamadı.
        </Card>
      )}
    </>
  );
}
