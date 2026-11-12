import { useState } from "react";
import { Landmark, ShieldCheck, CheckCircle2, Lock, ArrowRight, Shield } from "lucide-react";
import { api } from "../api/client";

function Login({ onSignIn }) {
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        await api.post("/auth/register", { username, password });
        setMode("signin");
        setMessage("Account created successfully. Please sign in to authenticate.");
      } else {
        await onSignIn(username, password);
      }
    } catch (error) {
      setMessage(
        error.message ||
          error.response?.data?.error ||
          "Authentication request failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-aside">
        <div className="auth-brand">
          <div className="brand-icon-box">
            <Landmark size={20} />
          </div>
          <span>LedgerLine Core</span>
        </div>

        <div className="auth-hero-copy">
          <span className="eyebrow">ENTERPRISE FINANCIAL INFRASTRUCTURE</span>
          <h1>Next-generation financial ledger infrastructure.</h1>
          <p>
            Enterprise financial operations ensuring money is securely moved,
            tracked, and reconciled with mathematical certainty.
          </p>

          <div className="proof-list">
            <div className="proof-item">
              <CheckCircle2 size={16} />
              <span>
                <strong>Real-Time Settlement:</strong> Zero overdraft guarantee with immediate balance verification.
              </span>
            </div>
            <div className="proof-item">
              <CheckCircle2 size={16} />
              <span>
                <strong>Duplicate Protection:</strong> Guaranteed single execution on all payment requests.
              </span>
            </div>
            <div className="proof-item">
              <CheckCircle2 size={16} />
              <span>
                <strong>Immutable Records:</strong> Permanent digital ledger preventing silent edits or deletions.
              </span>
            </div>
            <div className="proof-item">
              <CheckCircle2 size={16} />
              <span>
                <strong>Complete Audit Trail:</strong> Every approved and declined attempt is permanently cataloged.
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <Shield size={14} style={{ color: "var(--primary-500)" }} />
          <span>Bank-Grade 256-Bit SSL Protection · Authorized Personnel Only</span>
        </div>
      </div>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-header">
            <span className="eyebrow">
              {mode === "signin" ? "AUTHENTICATION" : "PROVISIONING"}
            </span>
            <h2>{mode === "signin" ? "Sign in to LedgerLine" : "Register Account Holder"}</h2>
            <p>
              {mode === "signin"
                ? "Enter your provisioned ledger credentials to access accounts."
                : "Self-service registration provisions an isolated Account Holder role."}
            </p>
          </div>

          <form onSubmit={submit}>
            <div className="form-group">
              <label>Username</label>
              <input
                autoComplete="username"
                autoFocus
                required
                minLength={3}
                maxLength={80}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={mode === "signin" ? 1 : 12}
                maxLength={72}
                placeholder={mode === "signin" ? "••••••••••••" : "Minimum 12 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {message && (
              <div
                className={`alert-box ${
                  message.includes("successfully")
                    ? "alert-success"
                    : "alert-danger"
                }`}
              >
                <span>{message}</span>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ padding: "12px", width: "100%", marginTop: "8px" }}
              disabled={submitting}
            >
              <span>{submitting ? "Authenticating..." : mode === "signin" ? "Sign In to Console" : "Create Account"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: "var(--text-secondary)",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {mode === "signin" ? "Need a new account?" : "Already registered?"}{" "}
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                color: "var(--emerald-400)",
                fontWeight: "700",
                cursor: "pointer",
              }}
              onClick={() => {
                setMessage("");
                setMode(mode === "signin" ? "register" : "signin");
              }}
            >
              {mode === "signin" ? "Register as Account Holder" : "Sign In"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
