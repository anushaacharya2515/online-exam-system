import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function StudentResultsPage() {
  const { session, logout } = useAuth();
  const token = session.token;

  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const examById = Object.fromEntries(exams.map((e) => [e.id, e]));
  const avgScore = results.length
    ? Math.round(results.reduce((sum, r) => sum + Number(r.score || 0), 0) / results.length)
    : 0;

  async function load() {
    try {
      const [e, r] = await Promise.all([
        api("/student/exams", { token }),
        api("/student/results", { token })
      ]);
      setExams(e);
      setResults(r);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="student-dash">
      <aside className="student-dash-sidebar">
        <div className="brand-row">
          <div className="brand-icon">A</div>
          <div>
            <h3>Academic</h3>
            <small>Student office</small>
          </div>
        </div>

        <div className="profile-mini">
          <div className="avatar">{session.user.email.slice(0, 1).toUpperCase()}</div>
          <div>
            <b>{session.user.email}</b>
            <small>Student</small>
          </div>
        </div>

        <nav className="menu-list">
          <Link to="/student">Dashboard</Link>
          <Link to="/student/exams">Exam</Link>
          <button className="active">Result</button>
          <Link to="/student/question-bank">Question Bank</Link>
        </nav>

        <button className="logout-btn" onClick={logout}>Logout</button>
      </aside>

      <main className="student-dash-main">
        <header className="student-dash-header">
          <h2>Results</h2>
          <div className="header-pill">{session.user.email}</div>
        </header>

        {error && <div className="error">{error}</div>}

        <section className="dash-activity">
          <div className="activity-item">
            <span>Total Attempts</span>
            <b>{results.length}</b>
          </div>
          <div className="activity-item">
            <span>Average Score</span>
            <b>{avgScore}</b>
          </div>
          <div className="activity-item">
            <span>Exams Taken</span>
            <b>{results.length}</b>
          </div>
          <div className="activity-item">
            <span>Available Exams</span>
            <b>{exams.length}</b>
          </div>
        </section>

        <section className="panel">
          <h3>Your Results</h3>
          <p className="muted">Scores for all submitted attempts.</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Score</th>
                  <th>Submitted Time (IST)</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && (
                  <tr>
                    <td colSpan="3" className="empty-cell">You have no submitted results yet.</td>
                  </tr>
                )}
                {results.map((r) => {
                  const submittedAt = r.submittedAt
                    ? new Date(r.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "-";
                  return (
                    <tr key={r.id}>
                      <td>{examById[r.examId]?.title || r.examId}</td>
                      <td>{r.score}</td>
                      <td>{submittedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

    </div>
  );
}
