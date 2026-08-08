import Image from "next/image";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"><div className="mb-8"><Image src="/logo.svg" alt="Welistup" width={192} height={60} priority/></div><h1 className="text-2xl font-bold">Tekrar hoş geldiniz</h1><p className="mt-2 text-sm text-slate-500">Agency OS paneline güvenli giriş yapın.</p><LoginForm/></div></main>;
}
