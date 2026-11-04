"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BookOpenIcon, PencilSquareIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 max-w-2xl text-center">
        <h1>
          <span className="block text-2xl mb-2">DApp</span>
          <span className="block text-4xl font-bold">Debt Ledger — кто кому должен</span>
        </h1>
        <p className="text-lg opacity-80">
          Прозрачный учёт долгов между студентами в блокчейне. Долг записывает сам должник, а погашение подтверждает
          только кредитор — поэтому никто не может приписать долг другому или тихо «списать» свой.
        </p>
        <div className="flex justify-center items-center flex-col">
          <p className="my-2 font-medium">Ваш адрес:</p>
          {connectedAddress ? (
            <Address address={connectedAddress} chain={targetNetwork} />
          ) : (
            <span className="opacity-70">кошелёк не подключён</span>
          )}
        </div>
      </div>

      <div className="grow bg-base-300 w-full mt-12 px-8 py-12">
        <div className="flex justify-center items-stretch gap-8 flex-col md:flex-row">
          <Link
            href="/ledger"
            className="card bg-base-100 shadow-md hover:shadow-xl transition max-w-xs w-full"
          >
            <div className="card-body items-center text-center">
              <BookOpenIcon className="h-8 w-8" />
              <h2 className="card-title">Реестр долгов</h2>
              <p className="m-0">Все записи, ваш баланс, проверка «кто кому должен» и лента событий.</p>
            </div>
          </Link>
          <Link
            href="/record"
            className="card bg-base-100 shadow-md hover:shadow-xl transition max-w-xs w-full"
          >
            <div className="card-body items-center text-center">
              <PencilSquareIcon className="h-8 w-8" />
              <h2 className="card-title">Записать / погасить</h2>
              <p className="m-0">Признать новый долг или подтвердить, что вам вернули деньги.</p>
            </div>
          </Link>
          <div className="card bg-base-100 shadow-md max-w-xs w-full">
            <div className="card-body items-center text-center">
              <ShieldCheckIcon className="h-8 w-8" />
              <h2 className="card-title">Правила контракта</h2>
              <p className="m-0">Сумма больше нуля, нельзя быть должным себе, погашает только кредитор.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
