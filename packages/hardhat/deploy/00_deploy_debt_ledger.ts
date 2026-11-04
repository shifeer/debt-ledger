import { deployScript, artifacts } from "../rocketh/deploy.js";

/**
 * Деплой контракта DebtLedger от имени аккаунта deployer.
 * На localhost deployer — первый аккаунт Hardhat, у него уже есть ETH на газ.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    const debtLedger = await env.deploy("DebtLedger", {
      account: deployer,
      artifact: artifacts.DebtLedger,
      args: [],
    });

    const count = await env.read(debtLedger, { functionName: "getDebtsCount" });
    console.log("📒 DebtLedger deployed at", debtLedger.address, "— records:", count.toString());
  },
  {
    tags: ["DebtLedger"],
  },
);
