import AdminShell from "../components/AdminShell";
import { Link } from "react-router-dom";

export default function AdminResults() {
  return (
    <AdminShell title="Results">
      <div className="card">
        <h3>Results</h3>
        <p className="muted">
          View all submitted results from the dashboard.
        </p>
        <Link className="link-btn" to="/admin">Go to Dashboard</Link>
      </div>
    </AdminShell>
  );
}
