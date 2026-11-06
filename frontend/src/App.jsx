
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
      <div className="app-layout">
        <Sidebar />

        <main className="main-content">
          <header className="topbar">
            <div>
              <h2>Overview</h2>
              <p>Welcome back to LedgerLine</p>
            </div>

            <div className="user-profile">
              <div className="avatar">A</div>
              <div>
                <strong>Admin User</strong>
                <small>Administrator</small>
              </div>
            </div>
          </header>

          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<h1>Accounts</h1>} />
              <Route path="/transactions" element={<h1>Transactions</h1>} />
              <Route path="/settings" element={<h1>Settings</h1>} />
            </Routes>
          </div>
        </main>
      </div>
  );
}

export default App;
