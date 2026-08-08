import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><Sidebar/><div className="lg:pl-64"><Header/><main className="p-5 lg:p-8">{children}</main></div></div>;
}
