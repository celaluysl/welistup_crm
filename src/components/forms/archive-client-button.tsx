"use client";
import{useTransition}from"react";import{useRouter}from"next/navigation";import{archiveClient}from"@/lib/actions/clients";import{Button}from"@/components/ui/button";
export function ArchiveClientButton({id}:{id:string}){const[pending,start]=useTransition();const router=useRouter();return <Button variant="danger" disabled={pending} onClick={()=>{if(confirm("Müşteri arşivlensin mi? Kayıt silinmeyecek."))start(async()=>{await archiveClient(id);router.push("/clients")})}}>{pending?"Arşivleniyor…":"Arşivle"}</Button>}
