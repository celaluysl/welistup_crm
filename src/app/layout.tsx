import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Welistup Agency OS",
  description: "Welistup ajans operasyon sistemi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-slate-50 text-slate-950">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
