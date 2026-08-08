import { VendorForm } from "@/components/forms/vendor-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
export default function NewVendor() {
  return (
    <>
      <PageHeader
        title="Yeni Tedarikçi"
        description="Sistem kullanıcısı olması gerekmeyen hizmet sağlayıcı kartı."
      />
      <Card className="max-w-3xl p-6">
        <VendorForm />
      </Card>
    </>
  );
}
