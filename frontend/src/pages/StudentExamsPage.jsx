import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function StudentExamsPage() {
  const { session, logout } = useAuth();
  const token = session.token;
  const navigate = useNavigate();

  const [exams, setExams] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api("/exams", { token });
      setExams(data);
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
          <Link to="/student">Dashboard</Link>
          <button className="active">Exam</button>
          <Link to="/student/results">Result</Link>
          <Link to="/student/question-bank">Question Bank</Link>
        </nav>

        <button className="logout-btn" onClick={logout}>Logout</button>
      </aside>

      <main className="student-dash-main">
        <header className="student-dash-header">
          <h2>Exams</h2>
          <div className="header-pill">{session.user.email}</div>
        </header>

        {error && <div className="error">{error}</div>}

        <section className="panel">
          <h3>Available Exams</h3>
          <p className="muted">Start any published exam below.</p>
          <ul className="list">
            {exams.length === 0 && <li className="empty-item">No exams available right now.</li>}
            {exams.map((e) => (
              <li key={e.id}>
                <div className="item-text">
                  <b>{e.examName || e.title}</b>
                  <div>{e.subject || "General"} | {e.durationMinutes} min | {e.totalQuestions || e.questionIds?.length || 0} questions</div>
                </div>
                <button onClick={() => startExam(e.id)}>Start Exam</button>
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
