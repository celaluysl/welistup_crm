import { redirect } from "next/navigation";

export default function OperationsIndex() {
  const now = new Date();
  redirect(`/operations/${now.getFullYear()}/${now.getMonth() + 1}`);
}
