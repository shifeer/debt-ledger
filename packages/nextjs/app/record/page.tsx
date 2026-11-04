"use client";

import { useMemo, useState } from "react";
import { Address, AddressInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { type Address as AddressType, isAddress } from "viem";
import { useAccount } from "wagmi";
import { TxStatus } from "~~/components/debt/TxStatus";
import { useDebtTx } from "~~/hooks/debt/useDebtTx";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

const MAX_NOTE_BYTES = 64;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

const RecordPage: NextPage = () => {
  const { address: me, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  // ---- форма «Признать долг» ----
  const [creditor, setCreditor] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const recordTx = useDebtTx();

  const noteBytes = byteLength(note);
  const amountValid = /^\d+$/.test(amount);
  const canSubmit = isConnected && isAddress(creditor) && amountValid && !recordTx.busy;

  const handleRecord = async () => {
    const ok = await recordTx.run(() =>
      recordTx.writeContractAsync({
        functionName: "recordDebt",
        args: [creditor as AddressType, BigInt(amount), note],
      }),
    );
    if (ok) {
      setCreditor("");
      setAmount("");
      setNote("");
    }
  };

  // ---- подтверждение погашения ----
  const repayTx = useDebtTx();
  const [repayingId, setRepayingId] = useState<bigint | null>(null);
  const { data: allDebts } = useScaffoldReadContract({ contractName: "DebtLedger", functionName: "getAllDebts" });

  const waitingForMe = useMemo(
    () =>
      (allDebts ?? []).filter(d => !d.repaid && me !== undefined && d.creditor.toLowerCase() === me.toLowerCase()),
    [allDebts, me],
  );

  const handleConfirm = async (id: bigint) => {
    setRepayingId(id);
    await repayTx.run(() => repayTx.writeContractAsync({ functionName: "confirmRepayment", args: [id] }));
    setRepayingId(null);
  };

  return (
    <div className="flex flex-col items-center grow px-4 py-10 gap-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Записать долг / подтвердить возврат</h1>
        <p className="opacity-70 m-0">
          Долг записывает тот, кто должен. Отметить долг погашенным может только тот, кому вернули.
        </p>
      </div>

      {!isConnected && (
        <div role="alert" className="alert alert-warning max-w-2xl w-full">
          <span>Подключите кошелёк MetaMask кнопкой «Connect Wallet» в правом верхнем углу.</span>
        </div>
      )}

      {/* Карточка 1: признать долг */}
      <div className="card bg-base-100 shadow-xl w-full max-w-2xl">
        <div className="card-body gap-4">
          <h2 className="card-title">Я признаю долг</h2>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Кому я должен (адрес кредитора)</span>
            <AddressInput value={creditor} onChange={setCreditor} placeholder="0x…" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Сумма, условных единиц</span>
            <input
              type="number"
              min={0}
              step={1}
              className="input input-bordered w-full"
              placeholder="например, 150"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">За что</span>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="например, обед в столовой"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <span className={`text-xs ${noteBytes > MAX_NOTE_BYTES ? "text-error" : "opacity-60"}`}>
              {noteBytes} / {MAX_NOTE_BYTES} байт (кириллица занимает 2 байта на символ)
            </span>
          </label>

          <button className="btn btn-primary" disabled={!canSubmit} onClick={handleRecord}>
            {recordTx.busy && <span className="loading loading-spinner loading-sm" />}
            Записать долг
          </button>

          <TxStatus phase={recordTx.phase} hash={recordTx.hash} error={recordTx.error} />
        </div>
      </div>

      {/* Карточка 2: подтвердить погашение */}
      <div className="card bg-base-100 shadow-xl w-full max-w-2xl">
        <div className="card-body gap-4">
          <h2 className="card-title">Мне должны — подтвердите, когда вернут</h2>

          {waitingForMe.length === 0 ? (
            <p className="opacity-70 m-0">Непогашенных долгов перед вами нет.</p>
          ) : (
            <ul className="flex flex-col gap-3 m-0 p-0 list-none">
              {waitingForMe.map(d => (
                <li
                  key={d.id.toString()}
                  className="flex flex-wrap items-center justify-between gap-3 border border-base-300 rounded-xl p-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm opacity-70">
                      #{d.id.toString()} · {d.note || "без комментария"}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Address address={d.debtor} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                      <span className="font-bold">должен {d.amount.toString()} ед.</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-success btn-sm"
                    disabled={repayTx.busy}
                    onClick={() => handleConfirm(d.id)}
                  >
                    {repayTx.busy && repayingId === d.id && <span className="loading loading-spinner loading-xs" />}
                    Возврат получен
                  </button>
                </li>
              ))}
            </ul>
          )}

          <TxStatus phase={repayTx.phase} hash={repayTx.hash} error={repayTx.error} />
        </div>
      </div>
    </div>
  );
};

export default RecordPage;
