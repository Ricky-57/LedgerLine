import { useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Lock,
  Plus,
  ShieldAlert,
  Wallet,
  X,
  Search,
} from "lucide-react";
import { api } from "../api/client";
import { money, formatTimeOnly, humanizeReason } from "../App";

function MovementDialog({ accounts, onClose, refresh }) {
  const [operation, setOperation] = useState("TRANSFER");
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? ""
  );
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [saving, setSaving] = useState(false);

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const destinationAccount = accounts.find((a) => a.id === destinationAccountId);

  // Live calculation of projected balance
  const parsedAmount = parseFloat(amount) || 0;
  const currentSourceBalance = parseFloat(sourceAccount?.balance) || 0;
  const projectedSourceBalance =
    operation === "DEPOSIT"
      ? currentSourceBalance
      : currentSourceBalance - parsedAmount;

  const isInsufficient =
    operation !== "DEPOSIT" &&
    parsedAmount > 0 &&
    projectedSourceBalance < 0;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const formattedAmount = Number(parsedAmount.toFixed(2));
      const body = { operation, amount: formattedAmount };
      if (operation !== "DEPOSIT") body.sourceAccountId = sourceAccountId;
      if (operation !== "WITHDRAWAL") body.destinationAccountId = destinationAccountId;

      const idempotencyKey = crypto.randomUUID();
      const response = await api.post("/money", body, {
        headers: { "Idempotency-Key": idempotencyKey },
      });

      if (response.data.status === "COMPLETED") {
        setMessageType("success");
        setMessage(
          `Movement authorized and settled successfully.`
        );
        await refresh();
        setTimeout(() => onClose(), 1200);
      } else {
        setMessageType("danger");
        setMessage(`Movement Declined: ${humanizeReason(response.data.reason)}`);
        await refresh();
      }
    } catch (requestError) {
      setMessageType("danger");
      const errReason = requestError.response?.data?.reason ?? requestError.response?.data?.error;
      setMessage(errReason ? humanizeReason(errReason) : "Transaction could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">POST TO LEDGER</span>
            <h2 id="movement-title">Initiate Money Movement</h2>
          </div>
          <button className="btn-icon" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabbed Operation Switcher */}
        <div className="tab-switcher">
          <button
            type="button"
            className={`tab-btn ${operation === "TRANSFER" ? "active" : ""}`}
            onClick={() => setOperation("TRANSFER")}
          >
            <ArrowLeftRight size={14} />
            <span>Transfer</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${operation === "DEPOSIT" ? "active" : ""}`}
            onClick={() => setOperation("DEPOSIT")}
          >
            <ArrowDownLeft size={14} />
            <span>Deposit</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${operation === "WITHDRAWAL" ? "active" : ""}`}
            onClick={() => setOperation("WITHDRAWAL")}
          >
            <ArrowUpRight size={14} />
            <span>Withdraw</span>
          </button>
        </div>

        <form onSubmit={submit}>
          {operation !== "DEPOSIT" && (
            <div className="form-group">
              <label>Debit Account (From)</label>
              <select
                required
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — Available: {money(acc.balance, acc.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {operation !== "WITHDRAWAL" && (
            <div className="form-group">
              <label>Credit Account (To)</label>
              <select
                required
                value={destinationAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — Currency: {acc.currency}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Amount</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Real-time Projected Balance Preview */}
          {sourceAccount && operation !== "DEPOSIT" && parsedAmount > 0 && (
            <div className="preview-box">
              <div className="preview-row">
                <span>Current Balance:</span>
                <strong>{money(currentSourceBalance, sourceAccount.currency)}</strong>
              </div>
              <div className="preview-row">
                <span>Movement Debit:</span>
                <strong style={{ color: "var(--rose-400)" }}>
                  - {money(parsedAmount, sourceAccount.currency)}
                </strong>
              </div>
              <div className="preview-row" style={{ borderTop: "1px dashed var(--border-subtle)", paddingTop: "4px" }}>
                <span>Projected Balance:</span>
                <strong
                  style={{
                    color: isInsufficient ? "var(--rose-400)" : "var(--emerald-400)",
                  }}
                >
                  {money(projectedSourceBalance, sourceAccount.currency)}
                </strong>
              </div>
            </div>
          )}

          {isInsufficient && (
            <div className="alert-box alert-danger">
              <ShieldAlert size={16} />
              <span>Insufficient balance. Zero overdraft is enforced server-side.</span>
            </div>
          )}

          <div className="idempotency-badge">
            <Lock size={14} />
            <span>Duplicate Transaction Protection Active</span>
          </div>

          {message && (
            <div className={`alert-box alert-${messageType === "success" ? "success" : "danger"}`}>
              {messageType === "success" ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              <span>{message}</span>
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || !accounts.length || isInsufficient}
          >
            {saving ? "Signing & Committing..." : "Authorize Movement"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Dashboard({ accounts, transactions, refresh, canCreate }) {
  const [showMovement, setShowMovement] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const totals = accounts.reduce(
    (result, account) => ({
      ...result,
      [account.currency]:
        (result[account.currency] ?? 0) + Number(account.balance),
    }),
    {}
  );

  const completed = transactions.filter((t) => t.status === "COMPLETED");
  const refused = transactions.filter((t) => t.status === "REFUSED");

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === "COMPLETED" && t.status !== "COMPLETED") return false;
    if (filterType === "REFUSED" && t.status !== "REFUSED") return false;
    if (filterType === "TRANSFER" && t.operation !== "TRANSFER") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = t.id?.toLowerCase().includes(q);
      const matchOp = t.operation?.toLowerCase().includes(q);
      const matchReason = t.reason?.toLowerCase().includes(q);
      const matchInit = t.initiatedBy?.toLowerCase().includes(q);
      if (!matchId && !matchOp && !matchReason && !matchInit) return false;
    }
    return true;
  });

  const stats = [
    {
      title: "Consolidated Liquidity",
      value:
        Object.entries(totals)
          .map(([curr, amt]) => money(amt, curr))
          .join(" · ") || money(0),
      caption: "Real-time ledger total",
      icon: Wallet,
      color: "emerald",
    },
    {
      title: "Ledger Accounts",
      value: String(accounts.length),
      caption: "Zero-overdraft accounts",
      icon: ArrowLeftRight,
      color: "indigo",
    },
    {
      title: "Settled Postings",
      value: String(completed.length),
      caption: "Balanced credit & debits",
      icon: Activity,
      color: "emerald",
    },
    {
      title: "Policy Refusals",
      value: String(refused.length),
      caption: "Captured audit attempts",
      icon: ArrowDownLeft,
      color: "rose",
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Operations Overview</h1>
          <p>
            Real-time multi-account balances, recent settlements, and authorized activity.
          </p>
        </div>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={() => setShowMovement(true)}
          >
            <Plus size={16} />
            <span>Initiate Movement</span>
          </button>
        )}
      </div>

      <section className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={stat.title}>
              <div className="stat-card-top">
                <p>{stat.title}</p>
                <div className={`stat-icon ${stat.color}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="stat-value">{stat.value}</div>
              <span className="stat-caption">{stat.caption}</span>
            </div>
          );
        })}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Recent Ledger Activity</h2>
            <p>Append-only record of authorized and refused requests</p>
          </div>
        </div>

        <div className="filter-bar">
          <button
            type="button"
            className={`filter-chip ${filterType === "ALL" ? "active" : ""}`}
            onClick={() => setFilterType("ALL")}
          >
            All Movements
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === "COMPLETED" ? "active" : ""}`}
            onClick={() => setFilterType("COMPLETED")}
          >
            Completed ({completed.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === "REFUSED" ? "active" : ""}`}
            onClick={() => setFilterType("REFUSED")}
          >
            Refused ({refused.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === "TRANSFER" ? "active" : ""}`}
            onClick={() => setFilterType("TRANSFER")}
          >
            Transfers
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search reference or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                minHeight: "30px",
                width: "200px",
              }}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Operation</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Audit Policy / Reason</th>
                <th>Initiator</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.slice(0, 10).map((t) => (
                <tr key={t.id}>
                  <td className="mono" style={{ color: "var(--indigo-400)" }}>
                    {t.id?.slice(0, 8)}...
                  </td>
                  <td>
                    <span className={`badge badge-${t.operation.toLowerCase()}`}>
                      {t.operation}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        t.operation === "DEPOSIT"
                          ? "amount-positive"
                          : t.operation === "WITHDRAWAL"
                          ? "amount-negative"
                          : "amount-neutral"
                      }
                    >
                      {t.operation === "DEPOSIT" ? "+ " : t.operation === "WITHDRAWAL" ? "- " : ""}
                      {money(t.amount, t.currency)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        t.status === "COMPLETED"
                          ? "badge-completed"
                          : "badge-refused"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td style={{ color: t.reason ? "var(--danger-500)" : "var(--text-muted)" }}>
                    {humanizeReason(t.reason)}
                  </td>
                  <td className="mono" style={{ color: "var(--text-secondary)" }}>
                    {t.initiatedBy ?? t.initiatedby}
                  </td>
                  <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {formatTimeOnly(t.createdAt ?? t.createdat)}
                  </td>
                </tr>
              ))}
              {!filteredTransactions.length && (
                <tr>
                  <td
                    colSpan="7"
                    style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}
                  >
                    No matching ledger movements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showMovement && (
        <MovementDialog
          accounts={accounts}
          onClose={() => setShowMovement(false)}
          refresh={refresh}
        />
      )}
    </>
  );
}

export default Dashboard;
