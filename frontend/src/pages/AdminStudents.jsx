import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AdminStudents() {
  const { session } = useAuth();
  const token = session.token;
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await api("/admin/students", { token });
        setStudents(data || []);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q));
  }, [students, search]);

  return (
    <AdminShell title="Students">
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="table-header">
          <div>
            <h3>Students</h3>
            <p className="muted">All registered students and their performance summary.</p>
          </div>
          <div className="search-row">
            <input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Exams Taken</th>
                <th>Average Score</th>
                <th>Last Attempt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-cell">No students found.</td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.examsTaken}</td>
                  <td>{s.averageScore}</td>
                  <td>{s.lastAttempt || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
