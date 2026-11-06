
import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    Activity,
} from "lucide-react";

const stats = [
    {
        title: "Total Balance",
        value: "₹12,45,800.00",
        icon: Wallet,
        color: "blue",
    },
    {
        title: "Total Deposits",
        value: "₹8,25,000.00",
        icon: ArrowDownLeft,
        color: "green",
    },
    {
        title: "Total Withdrawals",
        value: "₹2,40,500.00",
        icon: ArrowUpRight,
        color: "orange",
    },
    {
        title: "Transactions",
        value: "1,284",
        icon: Activity,
        color: "purple",
    },
];

const transactions = [
    { id: "TXN001", name: "Salary Credit", type: "Credit", amount: "+₹75,000", status: "Completed" },
    { id: "TXN002", name: "Rent Payment", type: "Debit", amount: "-₹18,000", status: "Completed" },
    { id: "TXN003", name: "Online Shopping", type: "Debit", amount: "-₹4,500", status: "Completed" },
    { id: "TXN004", name: "Interest Credit", type: "Credit", amount: "+₹1,250", status: "Completed" },
];

function Dashboard() {
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>Dashboard</h1>
                    <p>Monitor your banking activity and balances.</p>
                </div>
                <button className="primary-button">+ New Transaction</button>
            </div>

            <section className="stats-grid">
                {stats.map((stat) => {
                    const Icon = stat.icon;

                    return (
                        <div className="stat-card" key={stat.title}>
                            <div className={`stat-icon ${stat.color}`}>
                                <Icon size={22} />
                            </div>
                            <p>{stat.title}</p>
                            <h2>{stat.value}</h2>
                            <span className="stat-caption">Demo data</span>
                        </div>
                    );
                })}
            </section>

            <section className="transactions-card">
                <div className="card-header">
                    <div>
                        <h2>Recent Transactions</h2>
                        <p>Your latest account activity</p>
                    </div>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Description</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {transactions.map((txn) => (
                            <tr key={txn.id}>
                                <td>{txn.id}</td>
                                <td>{txn.name}</td>
                                <td>{txn.type}</td>
                                <td className={txn.type === "Credit" ? "credit" : "debit"}>
                                    {txn.amount}
                                </td>
                                <td><span className="status-badge">{txn.status}</span></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}

export default Dashboard;
