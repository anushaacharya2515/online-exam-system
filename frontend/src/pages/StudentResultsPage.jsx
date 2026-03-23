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
          <ul className="list">
            {results.length === 0 && <li className="empty-item">You have no submitted results yet.</li>}
            {results.map((r) => (
              <li key={r.id}>
                <div>
                  <b>{examById[r.examId]?.title || r.examId}</b>
                  <div>Score: {r.score}</div>
                  <small>{r.submittedAt}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <aside className="student-dash-right">
        <div className="testimony-panel">
          <h4>Testimony</h4>
          <div className="testimony-item">
            <div className="avatar">L</div>
            <div>
              <b>Leonardo</b>
              <p>Helped me score higher.</p>
            </div>
          </div>
          <div className="testimony-item">
            <div className="avatar">C</div>
            <div>
              <b>Chillene</b>
              <p>Clear layout and great prep.</p>
            </div>
          </div>
          <div className="testimony-item">
            <div className="avatar">S</div>
            <div>
              <b>Sukma</b>
              <p>Nice study bank.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
