import { ClientForm } from "@/components/forms/client-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
export default function NewClient() {
  return (
    <>
      <PageHeader
        title="Yeni müşteri"
        description="Müşteri, iletişim ve resmi fatura bilgilerini kaydedin."
      />
      <Card className="w-full p-6 lg:p-8">
        <ClientForm />
      </Card>
    </>
  );
}
