import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ArrowLeftRight,
  BarChart3,
  FileSignature,
  FileText,
  FolderKanban,
  Gauge,
  Handshake,
  History,
  Landmark,
  CalendarCheck,
  ReceiptText,
  Settings,
  Shapes,
  Store,
  Users,
  WalletCards,
  Banknote,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
const items = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/clients", label: "Müşteriler", icon: Building2 },
  { href: "/projects", label: "Projeler", icon: FolderKanban },
];
const linkClass =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-[#CD0B16] hover:text-white";
export async function Sidebar() {
  const s = await createClient();
  const [
    { data: settings },
    { data: team },
    { data: operations },
    { data: sales },
    { data: finance },
    { data: collections },
    { data: vendors },
    { data: accounts },
    { data: payroll },
    { data: monthClose },
  ] = await Promise.all([
    s.rpc("has_permission", { requested: "settings.manage" }),
    s.rpc("has_permission", { requested: "team.read" }),
    s.rpc("has_permission", { requested: "operations.read" }),
    s.rpc("has_permission", { requested: "sales.read" }),
    s.rpc("has_permission", { requested: "finance.read" }),
    s.rpc("has_permission", { requested: "collections.read" }),
    s.rpc("has_permission", { requested: "vendors.read" }),
    s.rpc("has_permission", { requested: "accounts.read" }),
    s.rpc("has_permission", { requested: "payroll.read" }),
    s.rpc("has_permission", { requested: "month_close.read" }),
  ]);
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-800 bg-slate-950 text-white lg:block">
      <div className="flex h-20 items-center border-b border-slate-800 px-6">
        <Image
          src="/logo.svg"
          alt="Welistup"
          width={150}
          height={47}
          priority
        />
      </div>
      <div className="px-3 py-6">
        <Group>Genel</Group>
        <nav className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        {sales && (
          <>
            <Group>Satış</Group>
            <Link href="/sales" className={linkClass}>
              <Handshake size={18} />
              Satış Pipeline
            </Link>
            <Link href="/offers" className={linkClass}>
              <FileSignature size={18} />
              Teklifler
            </Link>
            <Link href="/proformas" className={linkClass}>
              <ReceiptText size={18} />
              Proformalar
            </Link>
          </>
        )}
        {operations && (
          <>
            <Group>Operasyon</Group>
            <Link href="/reports" className={linkClass}>
              <FileText size={18} />
              Raporlar
            </Link>
          </>
        )}
        {(finance ||
          collections ||
          vendors ||
          accounts ||
          payroll ||
          monthClose) && (
          <>
            <Group>Finans</Group>
            {finance && (
              <>
                <Link href="/financial-reports" className={linkClass}>
                  <BarChart3 size={18} />
                  Finansal Raporlar
                </Link>
              </>
            )}
            <Link href="/collections" className={linkClass}>
              <Landmark size={18} />
              Alacak ve Tahsilat
            </Link>
            {vendors && (
              <>
                <Link href="/vendors" className={linkClass}>
                  <Store size={18} />
                  Tedarikçiler
                </Link>
              </>
            )}
          </>
        )}
        {accounts && (
          <>
            <Link href="/accounts" className={linkClass}>
              <WalletCards size={18} />
              Kasalar
            </Link>
            <Link href="/transactions" className={linkClass}>
              <ArrowLeftRight size={18} />
              Finans Hareketleri
            </Link>
          </>
        )}
        {payroll && (
          <Link href="/payroll" className={linkClass}>
            <Banknote size={18} />
            Maaşlar
          </Link>
        )}
        {monthClose && (
          <>
            <Link href="/partners" className={linkClass}>
              <Users size={18} />
              Ortaklar
            </Link>
            <Link href="/month-close" className={linkClass}>
              <CalendarCheck size={18} />
              Ay Kapanışı
            </Link>
          </>
        )}
        <Group>Yönetim</Group>
        <Link href="/services" className={linkClass}>
          <Shapes size={18} />
          Hizmetler
        </Link>
        {team && (
          <Link href="/team" className={linkClass}>
            <Users size={18} />
            Ekip
          </Link>
        )}
        {settings && (
          <>
            <Link href="/activity" className={linkClass}>
              <History size={18} />
              Activity Log
            </Link>
            <Link href="/settings" className={linkClass}>
              <Settings size={18} />
              Ayarlar
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 first:mt-0">
      {children}
    </div>
  );
}
