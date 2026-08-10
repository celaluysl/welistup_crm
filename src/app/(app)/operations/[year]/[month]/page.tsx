import { redirect } from "next/navigation";

export default function LegacyPaymentControl() {
  redirect("/collections");
}
