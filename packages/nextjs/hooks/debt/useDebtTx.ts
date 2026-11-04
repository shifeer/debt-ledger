import { useState } from "react";
import { TxPhase } from "~~/components/debt/TxStatus";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { getParsedError } from "~~/utils/scaffold-eth";

type TxResult = { phase: "idle" | "success" | "error"; hash?: string; error?: string };

/**
 * Обёртка над useScaffoldWriteContract для DebtLedger, которая отдаёт
 * фазу транзакции для панели TxStatus: подготовка → подпись в MetaMask → майнинг → успех / ошибка.
 */
export const useDebtTx = () => {
  const write = useScaffoldWriteContract({ contractName: "DebtLedger" });
  const { isPending, isMining, data: sentHash, reset } = write;
  const [result, setResult] = useState<TxResult>({ phase: "idle" });

  let phase: TxPhase = result.phase;
  if (isMining) {
    if (isPending) phase = "signing";
    else phase = sentHash ? "mining" : "preparing";
  }

  const run = async (send: () => Promise<string | undefined>) => {
    reset();
    setResult({ phase: "idle" });
    try {
      const hash = await send();
      if (hash) {
        setResult({ phase: "success", hash });
        return true;
      }
      setResult({ phase: "error", error: "Транзакция не отправлена: подключите кошелёк и выберите сеть Hardhat" });
    } catch (e) {
      setResult({ phase: "error", error: getParsedError(e) });
    }
    return false;
  };

  return {
    writeContractAsync: write.writeContractAsync,
    run,
    busy: isMining,
    phase,
    hash: result.hash,
    error: result.error,
  };
};
