"use client";

import { useMemo, useState } from "react";
import { Address, AddressInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { type Address as AddressType, isAddress } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

type Filter = "all" | "open" | "iOwe" | "owedToMe";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "open", label: "Непогашенные" },
  { key: "iOwe", label: "Я должен" },
  { key: "owedToMe", label: "Мне должны" },
];

const formatDate = (ts: bigint) =>
  new Date(Number(ts) * 1000).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

const LedgerPage: NextPage = () => {
  const { address: me } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const [filter, setFilter] = useState<Filter>("all");

  // ---- view-функции контракта ----
  const { data: debts, isLoading } = useScaffoldReadContract({
    contractName: "DebtLedger",
    functionName: "getAllDebts",
  });
  const { data: count } = useScaffoldReadContract({ contractName: "DebtLedger", functionName: "getDebtsCount" });
  const { data: myDebt } = useScaffoldReadContract({
    contractName: "DebtLedger",
    functionName: "totalDebtOf",
    args: [me],
  });
  const { data: myCredit } = useScaffoldReadContract({
    contractName: "DebtLedger",
    functionName: "totalCreditOf",
    args: [me],
  });

  // ---- проверка баланса между двумя адресами ----
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const pairReady = isAddress(pairA) && isAddress(pairB);
  const { data: net } = useScaffoldReadContract({
    contractName: "DebtLedger",
    functionName: "netBalance",
    args: [pairReady ? (pairA as AddressType) : undefined, pairReady ? (pairB as AddressType) : undefined],
  });

  // ---- события ----
  const { data: recorded } = useScaffoldEventHistory({
    contractName: "DebtLedger",
    eventName: "DebtRecorded",
    fromBlock: 0n,
    watch: true,
  });
  const { data: repaid } = useScaffoldEventHistory({
    contractName: "DebtLedger",
    eventName: "DebtRepaid",
    fromBlock: 0n,
    watch: true,
  });

  const feed = useMemo(() => {
    const items = [
      ...(recorded ?? []).map(e => ({
        key: `r-${e.transactionHash}-${e.logIndex}`,
        block: e.blockNumber ?? 0n,
        logIndex: e.logIndex ?? 0,
        kind: "recorded" as const,
        id: e.args.id,
        debtor: e.args.debtor,
        creditor: e.args.creditor,
        amount: e.args.amount,
      })),
      ...(repaid ?? []).map(e => ({
        key: `p-${e.transactionHash}-${e.logIndex}`,
        block: e.blockNumber ?? 0n,
        logIndex: e.logIndex ?? 0,
        kind: "repaid" as const,
        id: e.args.id,
        debtor: e.args.debtor,
        creditor: e.args.creditor,
        amount: e.args.amount,
      })),
    ];
    items.sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : a.block > b.block ? -1 : 1));
    return items.slice(0, 8);
  }, [recorded, repaid]);

  const rows = useMemo(() => {
    const list = [...(debts ?? [])].reverse();
    switch (filter) {
      case "open":
        return list.filter(d => !d.repaid);
      case "iOwe":
        return list.filter(d => same(d.debtor, me));
      case "owedToMe":
        return list.filter(d => same(d.creditor, me));
      default:
        return list;
    }
  }, [debts, filter, me]);

  return (
    <div className="flex flex-col items-center grow px-4 py-10 gap-8">
      <div className="text-center max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Реестр долгов</h1>
        <p className="opacity-70 m-0">Все записи читаются напрямую из смарт-контракта DebtLedger.</p>
      </div>

      {/* Сводка */}
      <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 w-full max-w-3xl">
        <div className="stat">
          <div className="stat-title">Записей в реестре</div>
          <div className="stat-value">{count?.toString() ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Я должен</div>
          <div className="stat-value text-error">{me ? (myDebt?.toString() ?? "…") : "—"}</div>
          <div className="stat-desc">условных единиц</div>
        </div>
        <div className="stat">
          <div className="stat-title">Мне должны</div>
          <div className="stat-value text-success">{me ? (myCredit?.toString() ?? "…") : "—"}</div>
          <div className="stat-desc">условных единиц</div>
        </div>
      </div>

      {/* Таблица */}
      <div className="card bg-base-100 shadow-xl w-full max-w-5xl">
        <div className="card-body gap-4">
          <div role="tablist" className="tabs tabs-box w-fit">
            {FILTERS.map(f => (
              <button
                key={f.key}
                role="tab"
                className={`tab ${filter === f.key ? "tab-active" : ""}`}
                onClick={() => setFilter(f.key)}
                disabled={!me && (f.key === "iOwe" || f.key === "owedToMe")}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <span className="loading loading-spinner loading-md" />
          ) : rows.length === 0 ? (
            <p className="opacity-70 m-0">Записей нет. Добавьте первую на странице «Записать / погасить».</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Должник</th>
                    <th>Кредитор</th>
                    <th className="text-right">Сумма</th>
                    <th>За что</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(d => (
                    <tr key={d.id.toString()}>
                      <td>{d.id.toString()}</td>
                      <td>
                        <Address address={d.debtor} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                      </td>
                      <td>
                        <Address address={d.creditor} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                      </td>
                      <td className="text-right font-mono">{d.amount.toString()}</td>
                      <td className="max-w-48 truncate">{d.note || "—"}</td>
                      <td className="whitespace-nowrap">{formatDate(d.createdAt)}</td>
                      <td>
                        {d.repaid ? (
                          <span className="badge badge-success">погашен</span>
                        ) : (
                          <span className="badge badge-warning">активен</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-8 w-full max-w-5xl md:grid-cols-2">
        {/* Баланс пары */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body gap-3">
            <h2 className="card-title">Кто кому должен?</h2>
            <AddressInput value={pairA} onChange={setPairA} placeholder="Адрес A" />
            <AddressInput value={pairB} onChange={setPairB} placeholder="Адрес B" />
            {pairReady && net !== undefined && (
              <p className="m-0 font-semibold">
                {net === 0n
                  ? "Взаимных непогашенных долгов нет"
                  : net > 0n
                    ? `A должен B: ${net.toString()} ед.`
                    : `B должен A: ${(-net).toString()} ед.`}
              </p>
            )}
          </div>
        </div>

        {/* Лента событий */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body gap-3">
            <h2 className="card-title">Последние события контракта</h2>
            {feed.length === 0 ? (
              <p className="opacity-70 m-0">Событий пока нет.</p>
            ) : (
              <ul className="m-0 p-0 list-none flex flex-col gap-2 text-sm">
                {feed.map(ev => (
                  <li key={ev.key} className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${ev.kind === "recorded" ? "badge-info" : "badge-success"}`}>
                      {ev.kind === "recorded" ? "DebtRecorded" : "DebtRepaid"}
                    </span>
                    <span>
                      #{ev.id?.toString()} · {ev.amount?.toString()} ед. · блок {ev.block.toString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedgerPage;
