"use client";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import {
  AccountForm,
  ManualMovementForm,
  TransferForm,
  type AccountOption,
} from "@/components/forms/account-forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

type AccountRow = AccountOption & {
  account_type: string;
  billing_preference: string;
  opening_balance: number;
  status: string;
  balance: number;
};
const labels: Record<string, string> = {
  bank: "Banka",
  cash: "Nakit",
  virtual: "Sanal",
  credit_card: "Kredi kartı",
  other: "Diğer",
};
type Dialog = "create" | "income" | "expense" | "transfer" | null;
export function AccountsWorkspace({ accounts }: { accounts: AccountRow[] }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const close = () => setDialog(null);
  return (
    <>
      <div className="mb-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDialog("income")}
        >
          <ArrowDownLeft size={16} />
          Para girişi
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDialog("expense")}
        >
          <ArrowUpRight size={16} />
          Para çıkışı
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDialog("transfer")}
        >
          <ArrowLeftRight size={16} />
          Transfer
        </Button>
        <Button type="button" onClick={() => setDialog("create")}>
          <Plus size={16} />
          Yeni kasa
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.map((account) => {
          const tone = accountTone(account);
          return (
            <Card
              key={account.id}
              className={`group relative overflow-hidden border-2 p-5 ${tone.card}`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
              <button
                type="button"
                onClick={() => setEditing(account)}
                aria-label="Kasayı düzenle"
                className={`absolute right-3 top-3 rounded-lg border bg-white/80 p-2 opacity-0 shadow-sm transition group-hover:opacity-100 ${tone.edit}`}
              >
                <Pencil size={15} />
              </button>
              <div className={`text-xs font-medium ${tone.muted}`}>
                {labels[account.account_type]}
                {account.account_type !== "cash" &&
                  ` · ${account.billing_preference === "invoiced" ? "Resmi" : "Faturasız"}`}
              </div>
              <h2 className={`mt-1 pr-8 font-semibold ${tone.title}`}>
                {account.name}
              </h2>
              <div className={`mt-4 text-xl font-bold ${tone.amount}`}>
                {formatMoney(account.balance, account.currency)}
              </div>
              <div className={`mt-1 text-xs ${tone.muted}`}>
                Sabit başlangıç:{" "}
                {formatMoney(account.opening_balance, account.currency)}
              </div>
            </Card>
          );
        })}
      </div>
      {dialog === "create" && (
        <Modal title="Yeni kasa" onClose={close}>
          <AccountForm onSuccess={close} />
        </Modal>
      )}
      {dialog === "income" && (
        <Modal title="Kasaya para girişi" onClose={close}>
          <ManualMovementForm
            accounts={accounts}
            type="income"
            onSuccess={close}
          />
        </Modal>
      )}
      {dialog === "expense" && (
        <Modal title="Kasadan para çıkışı" onClose={close}>
          <ManualMovementForm
            accounts={accounts}
            type="expense"
            onSuccess={close}
          />
        </Modal>
      )}
      {dialog === "transfer" && (
        <Modal title="Kasalar arası transfer" onClose={close}>
          <TransferForm accounts={accounts} onSuccess={close} />
        </Modal>
      )}
      {editing && (
        <Modal
          title="Kasayı düzenle"
          subtitle="Sabit başlangıç bakiyesi ve kasa bilgilerini değiştirebilirsiniz."
          onClose={() => setEditing(null)}
        >
          <AccountForm account={editing} onSuccess={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}

function accountTone(account: AccountRow) {
  const name = account.name.toLocaleLowerCase("tr-TR");
  if (name.includes("gider")) {
    return {
      card: "border-blue-200 bg-gradient-to-br from-blue-50 to-sky-100/70",
      bar: "bg-blue-500",
      muted: "text-blue-600/75",
      title: "text-blue-950",
      amount: "text-blue-900",
      edit: "border-blue-200 text-blue-600 hover:bg-blue-100",
    };
  }
  if (account.account_type === "cash" || name.includes("tahsilat")) {
    return {
      card: "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100/70",
      bar: "bg-orange-500",
      muted: "text-orange-700/75",
      title: "text-orange-950",
      amount: "text-orange-900",
      edit: "border-orange-200 text-orange-600 hover:bg-orange-100",
    };
  }
  return {
    card: "border-slate-200 bg-white",
    bar: "bg-slate-300",
    muted: "text-slate-500",
    title: "text-slate-900",
    amount: "text-slate-900",
    edit: "border-slate-200 text-slate-500 hover:bg-slate-100",
  };
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b p-5">
          <div>
            <h2 id="account-dialog-title" className="text-xl font-bold">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
