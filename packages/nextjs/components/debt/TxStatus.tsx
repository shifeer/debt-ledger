"use client";

import Link from "next/link";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export type TxPhase = "idle" | "preparing" | "signing" | "mining" | "success" | "error";

type TxStatusProps = {
  phase: TxPhase;
  hash?: string;
  error?: string;
};

const PENDING_TEXT: Record<"preparing" | "signing" | "mining", string> = {
  preparing: "Проверяем транзакцию…",
  signing: "Подтвердите транзакцию в MetaMask",
  mining: "Транзакция отправлена, ждём включения в блок…",
};

/**
 * Панель статуса транзакции: загрузка → успех / ошибка.
 */
export const TxStatus = ({ phase, hash, error }: TxStatusProps) => {
  if (phase === "idle") return null;

  if (phase === "success") {
    return (
      <div role="alert" className="alert alert-success" data-testid="tx-status">
        <CheckCircleIcon className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold m-0">Транзакция выполнена</p>
          {hash && (
            <Link href={`/blockexplorer/transaction/${hash}`} className="link text-xs break-all">
              {hash}
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div role="alert" className="alert alert-error" data-testid="tx-status">
        <ExclamationTriangleIcon className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold m-0">Ошибка транзакции</p>
          <p className="text-xs m-0 break-words">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="alert alert-info" data-testid="tx-status">
      <span className="loading loading-spinner loading-sm" />
      <span>{PENDING_TEXT[phase]}</span>
    </div>
  );
};
