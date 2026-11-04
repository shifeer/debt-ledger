// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title DebtLedger — учёт долгов между студентами
 * @notice Должник сам признаёт долг перед кредитором (запись делает только тот, кто должен),
 *         а отметить долг погашенным может только кредитор — тот, кому вернули.
 *         Так ни одна сторона не может в одиночку «повесить» долг на другого или «списать» свой.
 */
contract DebtLedger {
    struct Debt {
        uint256 id;
        address debtor; // кто должен
        address creditor; // кому должен
        uint256 amount; // сумма в условных единицах
        string note; // за что (до 64 байт)
        uint64 createdAt; // время записи
        bool repaid; // погашен ли
    }

    uint256 public constant MAX_NOTE_LENGTH = 64;

    Debt[] private debts;

    // owed[debtor][creditor] — сколько непогашенных единиц debtor должен creditor
    mapping(address => mapping(address => uint256)) public owed;
    // сколько всего непогашенных единиц должен адрес
    mapping(address => uint256) public totalDebtOf;
    // сколько всего непогашенных единиц должны адресу
    mapping(address => uint256) public totalCreditOf;

    /// @notice Должник признал новый долг
    event DebtRecorded(
        uint256 indexed id,
        address indexed debtor,
        address indexed creditor,
        uint256 amount,
        string note
    );

    /// @notice Кредитор подтвердил, что долг вернули
    event DebtRepaid(uint256 indexed id, address indexed debtor, address indexed creditor, uint256 amount);

    modifier debtExists(uint256 id) {
        require(id < debts.length, "Debt does not exist");
        _;
    }

    modifier onlyCreditor(uint256 id) {
        require(msg.sender == debts[id].creditor, "Only creditor can confirm repayment");
        _;
    }

    // ------------------------------------------------------------------
    //                           write-функции
    // ------------------------------------------------------------------

    /**
     * @notice Признать долг: вызывающий адрес становится должником.
     * @param creditor кому должен
     * @param amount   сумма в условных единицах (> 0)
     * @param note     комментарий, например «обед в столовой»
     * @return id      номер записи
     */
    function recordDebt(address creditor, uint256 amount, string calldata note) external returns (uint256 id) {
        require(creditor != address(0), "Creditor is zero address");
        require(creditor != msg.sender, "Cannot owe yourself");
        require(amount > 0, "Amount must be positive");
        require(bytes(note).length <= MAX_NOTE_LENGTH, "Note is too long");

        id = debts.length;
        debts.push(
            Debt({
                id: id,
                debtor: msg.sender,
                creditor: creditor,
                amount: amount,
                note: note,
                createdAt: uint64(block.timestamp),
                repaid: false
            })
        );

        owed[msg.sender][creditor] += amount;
        totalDebtOf[msg.sender] += amount;
        totalCreditOf[creditor] += amount;

        emit DebtRecorded(id, msg.sender, creditor, amount, note);
    }

    /**
     * @notice Подтвердить погашение долга. Доступно только кредитору этой записи.
     */
    function confirmRepayment(uint256 id) external debtExists(id) onlyCreditor(id) {
        Debt storage d = debts[id];
        require(!d.repaid, "Debt already repaid");

        d.repaid = true;
        owed[d.debtor][d.creditor] -= d.amount;
        totalDebtOf[d.debtor] -= d.amount;
        totalCreditOf[d.creditor] -= d.amount;

        emit DebtRepaid(id, d.debtor, d.creditor, d.amount);
    }

    // ------------------------------------------------------------------
    //                           view-функции
    // ------------------------------------------------------------------

    /// @notice Количество записей в реестре
    function getDebtsCount() external view returns (uint256) {
        return debts.length;
    }

    /// @notice Одна запись по номеру
    function getDebt(uint256 id) external view debtExists(id) returns (Debt memory) {
        return debts[id];
    }

    /// @notice Все записи реестра (для учебного масштаба — одна группа студентов)
    function getAllDebts() external view returns (Debt[] memory) {
        return debts;
    }

    /// @notice Чистый баланс между двумя адресами: >0 — a должен b, <0 — b должен a
    function netBalance(address a, address b) external view returns (int256) {
        return int256(owed[a][b]) - int256(owed[b][a]);
    }
}
