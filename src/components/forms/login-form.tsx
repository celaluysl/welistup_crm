"use client";
import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return <form action={action} className="mt-8 space-y-5"><label className="grid gap-2 text-sm font-medium">E-posta<input name="email" type="email" required autoComplete="email" className={inputClass} placeholder="isim@welistup.com"/></label><label className="grid gap-2 text-sm font-medium">Şifre<input name="password" type="password" required autoComplete="current-password" className={inputClass}/></label>{state?.error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}<Button disabled={pending} className="w-full">{pending ? "Giriş yapılıyor…" : "Giriş yap"}</Button></form>;
}
