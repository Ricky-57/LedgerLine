import { useState } from "react";
import {
  Copy,
  Check,
  Eye,
  Plus,
  X,
  FileText,
  ShieldCheck,
  Building2,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { api } from "../api/client";
import { money, formatDateTime, humanizeReason } from "../App";

function Accounts({ accounts, refresh, role }) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statement, setStatement] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", currency: "USD" });

  async function createAccount(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/accounts", form);
      setForm({ name: "", currency: "USD" });
      setCreating(false);
      await refresh();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ?? "Account could not be created."
      );
    }
  }

  async function openStatement(account) {
    setSelected(account);
    setError("");
    try {
      const response = await api.get(`/accounts/${account.id}/statement`);
      setStatement(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ?? "Statement could not be loaded."
      );
    }
  }

  function copyToClipboard(id) {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Managed Accounts</h1>
          <p>
            Enterprise asset accounts with zero-overdraft balance protection.
          </p>
        </div>
        {role !== "AUDITOR" && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            <span>New Account</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert-box alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="accounts-grid">
        {accounts.map((account) => (
          <article className="account-card" key={account.id}>
            <div className="account-card-header">
              <div className="account-title-box">
                <h3>{account.name}</h3>
                <button
                  type="button"
                  className="account-id-copy"
                  title="Copy Account ID"
                  onClick={() => copyToClipboard(account.id)}
                >
                  <span>{account.id.slice(0, 14)}...</span>
                  {copiedId === account.id ? (
                    <Check size={12} style={{ color: "var(--emerald-400)" }} />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
              <div className="currency-badge">{account.currency}</div>
            </div>

            <div className="account-card-balance">
              <small>Available Balance</small>
              <div className="balance-val">
                {money(account.balance, account.currency)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "12px",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ShieldCheck size={13} style={{ color: "var(--success-500)" }} />
                Zero Overdraft
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                type="button"
                onClick={() => openStatement(account)}
              >
                <Eye size={14} />
                <span>Statement</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {!accounts.length && (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <Building2
            size={40}
            style={{ color: "var(--text-muted)", margin: "0 auto 12px" }}
          />
          <h3 style={{ color: "var(--text-primary)", marginBottom: "4px" }}>
            No accounts available
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Create an account to start depositing and moving funds.
          </p>
        </div>
      )}

      {/* Create Account Modal */}
      {creating && (
        <div className="dialog-backdrop">
          <section className="dialog" role="dialog" aria-modal="true">
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">NEW ASSET ACCOUNT</span>
                <h2>Open Ledger Account</h2>
              </div>
              <button
                className="btn-icon"
                type="button"
                onClick={() => setCreating(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createAccount}>
              <div className="form-group">
                <label>Account Descriptive Name</label>
                <input
                  autoFocus
                  required
                  placeholder="e.g. Operations Treasury, Payroll Escrow"
                  maxLength="120"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Operating Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="USD">USD — United States Dollar</option>
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                </select>
              </div>

              <p
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  lineHeight: "1.5",
                }}
              >
                New accounts open with a zero balance. Funds can be credited through
                authorized deposits or incoming transfers.
              </p>

              <button className="btn btn-primary" type="submit">
                Create Account
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Statement Audit Modal */}
      {selected && (
        <div
          className="dialog-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <section
            className="dialog statement-dialog"
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">ACCOUNT STATEMENT</span>
                <h2>{selected.name}</h2>
                <span
                  className="mono"
                  style={{ fontSize: "11px", color: "var(--text-muted)" }}
                >
                  Account Ref: {selected.id}
                </span>
              </div>
              <button
                className="btn-icon"
                type="button"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "var(--bg-surface-elevated)",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Audited Available Balance
                </span>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: "800",
                    color: "var(--text-primary)",
                  }}
                >
                  {money(selected.balance, selected.currency)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: "var(--success-500)",
                }}
              >
                <ShieldCheck size={16} />
                <span>Verified Account Statement</span>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Entry Type</th>
                    <th>Amount</th>
                    <th>Running Balance After</th>
                    <th>Initiator</th>
                    <th>Audit Status / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((entry) => {
                    const entryType = entry.entryType ?? entry.entrytype;
                    const balanceAfter = entry.balanceAfter ?? entry.balanceafter;
                    const initiatedBy = entry.initiatedBy ?? entry.initiatedby;
                    const createdAt = entry.createdAt ?? entry.createdat;

                    return (
                      <tr key={entry.id}>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {formatDateTime(createdAt)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              entryType === "CREDIT"
                                ? "badge-deposit"
                                : entryType === "DEBIT"
                                ? "badge-refused"
                                : "badge-withdrawal"
                            }`}
                          >
                            {entryType}
                          </span>
                        </td>
                        <td
                          className={
                            entryType === "CREDIT"
                              ? "amount-positive"
                              : entryType === "DEBIT"
                              ? "amount-negative"
                              : "amount-neutral"
                          }
                        >
                          {entryType === "CREDIT" ? "+ " : entryType === "DEBIT" ? "- " : ""}
                          {money(entry.amount, selected.currency)}
                        </td>
                        <td className="mono" style={{ fontWeight: "700", color: "var(--text-primary)" }}>
                          {money(balanceAfter, selected.currency)}
                        </td>
                        <td className="mono">{initiatedBy}</td>
                        <td
                          style={{
                            color:
                              entryType === "REFUSED"
                                ? "var(--danger-500)"
                                : "var(--text-muted)",
                          }}
                        >
                          {humanizeReason(entry.reason)}
                        </td>
                      </tr>
                    );
                  })}
                  {!statement.length && (
                    <tr>
                      <td
                        colSpan="6"
                        style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}
                      >
                        No historical entries found for this account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default Accounts;
