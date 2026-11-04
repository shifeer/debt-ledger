// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { DebtLedger } from "../contracts/DebtLedger.sol";

/// Тесты контракта DebtLedger. Запуск: `yarn hardhat:test` (Hardhat 3 выполняет Solidity-тесты).
contract DebtLedgerTest is Test {
    DebtLedger internal ledger;

    address internal alice = makeAddr("alice"); // должник
    address internal bob = makeAddr("bob"); // кредитор
    address internal carol = makeAddr("carol"); // посторонний

    // события объявлены повторно, чтобы использовать их в vm.expectEmit
    event DebtRecorded(
        uint256 indexed id,
        address indexed debtor,
        address indexed creditor,
        uint256 amount,
        string note
    );
    event DebtRepaid(uint256 indexed id, address indexed debtor, address indexed creditor, uint256 amount);

    function setUp() public {
        ledger = new DebtLedger();
    }

    // ---------- 1. write-функция recordDebt меняет состояние ----------

    function test_RecordDebt_StoresDebtAndUpdatesBalances() public {
        vm.prank(alice);
        uint256 id = ledger.recordDebt(bob, 150, "Lunch in canteen");

        assertEq(id, 0);
        assertEq(ledger.getDebtsCount(), 1);

        DebtLedger.Debt memory d = ledger.getDebt(0);
        assertEq(d.debtor, alice);
        assertEq(d.creditor, bob);
        assertEq(d.amount, 150);
        assertEq(d.note, "Lunch in canteen");
        assertFalse(d.repaid);

        assertEq(ledger.owed(alice, bob), 150);
        assertEq(ledger.totalDebtOf(alice), 150);
        assertEq(ledger.totalCreditOf(bob), 150);
        assertEq(ledger.netBalance(alice, bob), 150);
        assertEq(ledger.netBalance(bob, alice), -150);
    }

    function test_RecordDebt_AccumulatesSeveralDebts() public {
        vm.startPrank(alice);
        ledger.recordDebt(bob, 100, "Taxi");
        ledger.recordDebt(bob, 40, "Coffee");
        vm.stopPrank();

        vm.prank(bob);
        ledger.recordDebt(alice, 30, "Printing");

        assertEq(ledger.getDebtsCount(), 3);
        assertEq(ledger.owed(alice, bob), 140);
        assertEq(ledger.owed(bob, alice), 30);
        assertEq(ledger.netBalance(alice, bob), 110);
    }

    // ---------- 2. проверка эмиссии события ----------

    function test_RecordDebt_EmitsDebtRecorded() public {
        vm.expectEmit(true, true, true, true, address(ledger));
        emit DebtRecorded(0, alice, bob, 150, "Lunch in canteen");

        vm.prank(alice);
        ledger.recordDebt(bob, 150, "Lunch in canteen");
    }

    function test_ConfirmRepayment_EmitsDebtRepaidAndClearsBalances() public {
        vm.prank(alice);
        ledger.recordDebt(bob, 150, "Lunch in canteen");

        vm.expectEmit(true, true, true, true, address(ledger));
        emit DebtRepaid(0, alice, bob, 150);

        vm.prank(bob);
        ledger.confirmRepayment(0);

        assertTrue(ledger.getDebt(0).repaid);
        assertEq(ledger.owed(alice, bob), 0);
        assertEq(ledger.totalDebtOf(alice), 0);
        assertEq(ledger.totalCreditOf(bob), 0);
    }

    // ---------- 3. проверки require (ошибочные сценарии) ----------

    function test_RevertWhen_NonCreditorConfirmsRepayment() public {
        vm.prank(alice);
        ledger.recordDebt(bob, 150, "Lunch in canteen");

        // должник пытается сам «списать» свой долг
        vm.prank(alice);
        vm.expectRevert(bytes("Only creditor can confirm repayment"));
        ledger.confirmRepayment(0);

        // посторонний тоже не может
        vm.prank(carol);
        vm.expectRevert(bytes("Only creditor can confirm repayment"));
        ledger.confirmRepayment(0);
    }

    function test_RevertWhen_AmountIsZero() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Amount must be positive"));
        ledger.recordDebt(bob, 0, "Nothing");
    }

    function test_RevertWhen_OweYourself() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Cannot owe yourself"));
        ledger.recordDebt(alice, 10, "Self");
    }

    function test_RevertWhen_CreditorIsZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Creditor is zero address"));
        ledger.recordDebt(address(0), 10, "Nobody");
    }

    function test_RevertWhen_NoteTooLong() public {
        string memory longNote = "0123456789012345678901234567890123456789012345678901234567890123456789"; // 70 байт
        vm.prank(alice);
        vm.expectRevert(bytes("Note is too long"));
        ledger.recordDebt(bob, 10, longNote);
    }

    function test_RevertWhen_RepaidTwice() public {
        vm.prank(alice);
        ledger.recordDebt(bob, 50, "Book");

        vm.startPrank(bob);
        ledger.confirmRepayment(0);
        vm.expectRevert(bytes("Debt already repaid"));
        ledger.confirmRepayment(0);
        vm.stopPrank();
    }

    function test_RevertWhen_DebtDoesNotExist() public {
        vm.prank(bob);
        vm.expectRevert(bytes("Debt does not exist"));
        ledger.confirmRepayment(42);
    }
}
