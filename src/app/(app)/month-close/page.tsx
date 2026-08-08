import { redirect } from "next/navigation";
export default function MonthCloseIndex() {
  const n = new Date();
  redirect(`/month-close/${n.getFullYear()}/${n.getMonth() + 1}`);
}
