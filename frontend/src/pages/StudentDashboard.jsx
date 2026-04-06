import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { session, logout } = useAuth();
  const token = session.token;
  const navigate = useNavigate();

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

  async function startExam(examId) {
    try {
      const attempt = await api(`/student/exams/${examId}/start`, { token, method: "POST" });
      navigate(`/exam/${attempt.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

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
          <button className="active">Dashboard</button>
          <Link to="/student/exams">Exam</Link>
          <Link to="/student/results">Result</Link>
          <Link to="/student/question-bank">Question Bank</Link>
        </nav>

        <button className="logout-btn" onClick={logout}>Logout</button>
      </aside>

      <main className="student-dash-main">
        <header className="student-dash-header">
          <h2>Dashboard</h2>
          <div className="header-pill">{session.user.email}</div>
        </header>

        {error && <div className="error">{error}</div>}

        <div className="dash-section-title">Activity</div>
        <section className="dash-activity">
          <div className="activity-item">
            <span>Presence</span>
            <b>{results.length}</b>
          </div>
          <div className="activity-item">
            <span>Tests</span>
            <b>{exams.length}</b>
          </div>
          <div className="activity-item">
            <span>Exams</span>
            <b>{exams.length}</b>
          </div>
          <div className="activity-item">
            <span>Average</span>
            <b>{avgScore}</b>
          </div>
        </section>

        <div className="dash-section-title">Your Workspace</div>
        <section className="dash-panels">
          <article className="panel" id="student-exams">
            <h3>Available Exams</h3>
            <p className="muted">Start any published exam below.</p>
            <ul className="list">
              {exams.length === 0 && <li className="empty-item">No exams available right now.</li>}
              {exams.map((e) => (
                <li key={e.id}>
                  <div className="item-text">
                    <b>{e.title}</b>
                    <div>{e.durationMinutes} min | {e.totalQuestions} questions</div>
                  </div>
                  <button onClick={() => startExam(e.id)}>Start Exam</button>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel" id="student-results">
            <h3>Your Results</h3>
            <p className="muted">Scores for all submitted attempts.</p>
            <ul className="list">
              {results.length === 0 && <li className="empty-item">You have no submitted results yet.</li>}
              {results.map((r) => (
                <li key={r.id}>
                  <div>Exam: {examById[r.examId]?.title || r.examId}</div>
                  <div>Score: {r.score}</div>
                  <small>{r.submittedAt}</small>
                </li>
              ))}
            </ul>
          </article>
        </section>
      </main>

    </div>
  );
}
