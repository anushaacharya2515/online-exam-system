import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AdminResults() {
  const { session } = useAuth();
  const token = session.token;
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/admin/results", { token });
        setResults(data || []);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  function formatDuration(ms) {
    if (!ms && ms !== 0) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  function downloadCsv() {
    if (!results.length) return;
    const header = ["Student Name", "Student Email", "Attempt ID", "Exam", "Score", "Time Taken", "Submitted At"];
    const rows = results.map((r) => [
      r.studentName || "Unknown",
      r.studentEmail || "",
      r.id || "",
      r.examTitle || r.examId || "",
      r.score ?? 0,
      formatDuration(r.timeTakenMs),
      r.submittedAt || ""
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title="Results">
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="table-header">
          <div>
            <h3>Results</h3>
            <p className="muted">All submitted attempts with scores.</p>
          </div>
          <div className="row-actions">
            <button className="ghost" onClick={downloadCsv}>Download CSV</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Attempt ID</th>
                <th>Exam</th>
                <th>Score</th>
                <th>Time Taken</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">No results available yet.</td>
                </tr>
              )}
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{r.studentName || r.studentEmail || "Unknown"}</td>
                  <td className="mono">{r.id}</td>
                  <td>{r.examTitle || r.examId}</td>
                  <td>{r.score ?? 0}</td>
                  <td>{formatDuration(r.timeTakenMs)}</td>
                  <td>{r.submittedAt || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
