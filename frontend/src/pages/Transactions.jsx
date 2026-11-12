import { useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { money, formatDateTime, humanizeReason } from "../App";

function Transactions({ transactions, accounts }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const accountNames = Object.fromEntries(
    accounts.map((acc) => [acc.id, acc.name])
  );

  function copy(id) {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = transactions.filter((t) => {
    if (filter === "COMPLETED" && t.status !== "COMPLETED") return false;
    if (filter === "REFUSED" && t.status !== "REFUSED") return false;
    if (filter === "TRANSFER" && t.operation !== "TRANSFER") return false;
    if (filter === "DEPOSIT" && t.operation !== "DEPOSIT") return false;
    if (filter === "WITHDRAWAL" && t.operation !== "WITHDRAWAL") return false;

    if (search) {
      const q = search.toLowerCase();
      const matchId = t.id?.toLowerCase().includes(q);
      const matchOp = t.operation?.toLowerCase().includes(q);
      const matchReason = t.reason?.toLowerCase().includes(q);
      const matchInit = t.initiatedBy?.toLowerCase().includes(q);
      if (!matchId && !matchOp && !matchReason && !matchInit) return false;
    }
    return true;
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Transaction Activity & Audit Log</h1>
          <p>
            Comprehensive verified history of all account movements and authorized activity.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar" style={{ padding: "14px 20px" }}>
          <button
            type="button"
            className={`filter-chip ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            All Activity ({transactions.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === "COMPLETED" ? "active" : ""}`}
            onClick={() => setFilter("COMPLETED")}
          >
            Completed
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === "REFUSED" ? "active" : ""}`}
            onClick={() => setFilter("REFUSED")}
          >
            Refused
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === "TRANSFER" ? "active" : ""}`}
            onClick={() => setFilter("TRANSFER")}
          >
            Transfers
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === "DEPOSIT" ? "active" : ""}`}
            onClick={() => setFilter("DEPOSIT")}
          >
            Deposits
          </button>
          <button
            type="button"
            className={`filter-chip ${filter === "WITHDRAWAL" ? "active" : ""}`}
            onClick={() => setFilter("WITHDRAWAL")}
          >
            Withdrawals
          </button>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search ID, initiator, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                width: "240px",
                minHeight: "32px",
              }}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Timestamp</th>
                <th>Operation</th>
                <th>Debit (From)</th>
                <th>Credit (To)</th>
                <th>Amount</th>
                <th>State</th>
                <th>Initiated By</th>
                <th>Audit Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      type="button"
                      className="account-id-copy"
                      onClick={() => copy(t.id)}
                      title="Copy Request ID"
                    >
                      <span style={{ color: "var(--indigo-400)" }}>
                        {t.id?.slice(0, 8)}...
                      </span>
                      {copiedId === t.id ? (
                        <Check size={12} style={{ color: "var(--emerald-400)" }} />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {formatDateTime(t.createdAt ?? t.createdat)}
                  </td>
                  <td>
                    <span className={`badge badge-${t.operation.toLowerCase()}`}>
                      {t.operation}
                    </span>
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {accountNames[t.sourceAccountId ?? t.sourceaccountid] ??
                      ((t.sourceAccountId ?? t.sourceaccountid) ? "Restricted" : "— (External)")}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {accountNames[t.destinationAccountId ?? t.destinationaccountid] ??
                      ((t.destinationAccountId ?? t.destinationaccountid) ? "Restricted" : "— (External)")}
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
                      {t.operation === "DEPOSIT"
                        ? "+ "
                        : t.operation === "WITHDRAWAL"
                        ? "- "
                        : ""}
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
                  <td className="mono" style={{ color: "var(--text-primary)" }}>
                    {t.initiatedBy ?? t.initiatedby}
                  </td>
                  <td
                    style={{
                      fontSize: "12px",
                      color:
                        t.status === "REFUSED"
                          ? "var(--danger-500)"
                          : "var(--text-muted)",
                    }}
                  >
                    {humanizeReason(t.reason)}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td
                    colSpan="9"
                    style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}
                  >
                    No transactions match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default Transactions;
