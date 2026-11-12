import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { CircleAlert, LogOut, RefreshCw, ShieldCheck, CheckCircle2 } from "lucide-react";
import Sidebar from "./components/Sidebar";
import { api, configureAuth } from "./api/client";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Login from "./pages/Login";

export const money = (amount, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(Number(amount ?? 0));

export const formatDateTime = (val) => {
  if (!val) return "—";
  const date = new Date(val);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

export const formatTimeOnly = (val) => {
  if (!val) return "—";
  const date = new Date(val);
  return isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export const humanizeReason = (reason) => {
  if (!reason) return "Settled";
  const map = {
    INSUFFICIENT_FUNDS: "Insufficient available balance",
    NOT_AUTHORIZED: "Unauthorized account access",
    CURRENCY_MISMATCH: "Currency mismatch between accounts",
    SAME_ACCOUNT: "Source and destination must differ",
    ACCOUNT_NOT_FOUND: "Account not found",
    IDEMPOTENCY_KEY_REUSED: "Duplicate request payload conflict",
  };
  return map[reason] || reason.replace(/_/g, " ");
};

function App() {
  const [credentials, setAuthState] = useState(null);
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  async function loadLedger() {
    setLoading(true);
    setError("");
    try {
      const [me, accountResponse, transactionResponse] = await Promise.all([
        api.get("/auth/me"),
        api.get("/accounts"),
        api.get("/transactions"),
      ]);
      setUser(me.data);
      setAccounts(accountResponse.data);
      setTransactions(transactionResponse.data);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setAuthState(null);
        configureAuth(null);
        setUser(null);
      } else {
        setError(requestError.response?.data?.error ?? "Ledger service is unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (credentials) loadLedger();
  }, [credentials]);

  async function signIn(username, password) {
    const next = { username, password };
    configureAuth(next);
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
      setAuthState(next);
    } catch (requestError) {
      configureAuth(null);
      throw new Error(
        requestError.response?.status === 401
          ? "Username or password is incorrect."
          : "Could not reach the ledger service."
      );
    }
  }

  function signOut() {
    setAuthState(null);
    configureAuth(null);
    setUser(null);
    setAccounts([]);
    setTransactions([]);
    navigate("/login");
  }

  if (!credentials || !user) return <Login onSignIn={signIn} />;

  const pageTitles = {
    "/": "Ledger Overview",
    "/accounts": "Managed Accounts",
    "/transactions": "Transaction Logs & Audit Trail",
  };

  const roleClass = user.role.toLowerCase();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">
              <span className="eyebrow">Enterprise Core</span>
              <h2>{pageTitles[location.pathname] ?? "Ledger"}</h2>
            </div>
            <div className="invariant-pill">
              <CheckCircle2 size={14} />
              <span>Audit Verified & Balanced</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="btn-icon"
              type="button"
              title="Refresh Ledger"
              onClick={loadLedger}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>

            <div className="user-badge-wrap">
              <div className="user-avatar">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="user-meta">
                <span className="user-name">{user.username}</span>
                <span className={`role-tag ${roleClass}`}>
                  {user.role.replaceAll("_", " ")}
                </span>
              </div>
            </div>

            <button
              className="btn-icon"
              type="button"
              title="Sign Out"
              onClick={signOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="alert-box alert-danger" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  accounts={accounts}
                  transactions={transactions}
                  refresh={loadLedger}
                  canCreate={user.role !== "AUDITOR"}
                />
              }
            />
            <Route
              path="/accounts"
              element={
                <Accounts
                  accounts={accounts}
                  refresh={loadLedger}
                  role={user.role}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <Transactions
                  transactions={transactions}
                  accounts={accounts}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
