import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import AdminShell from "../components/AdminShell";

export default function AdminDashboard() {
  const { session } = useAuth();
  const token = session.token;

  const [questions, setQuestions] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  const examById = useMemo(() => Object.fromEntries(exams.map((e) => [e.id, e])), [exams]);
  const resultsByExam = useMemo(() => {
    return results.reduce((acc, r) => {
      const key = r.examId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {});
  }, [results]);

  const scoresByDay = useMemo(() => {
    const map = {};
    results.forEach((r) => {
      const d = (r.submittedAt || "").slice(0, 10);
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(Number(r.score || 0));
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, scores]) => ({
        day,
        avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      }))
      .slice(-10);
  }, [results]);

  const attemptsByDay = useMemo(() => {
    const map = {};
    results.forEach((r) => {
      const d = (r.submittedAt || "").slice(0, 10);
      if (!d) return;
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }))
      .slice(-10);
  }, [results]);

  const avgScoreByExam = useMemo(() => {
    return Object.entries(resultsByExam).map(([examId, list]) => {
      const avg = list.length
        ? Math.round(list.reduce((s, r) => s + Number(r.score || 0), 0) / list.length)
        : 0;
      return { examId, title: examById[examId]?.title || examId, avg };
    }).sort((a, b) => b.avg - a.avg).slice(0, 6);
  }, [resultsByExam, examById]);

  const difficultyDistribution = useMemo(() => {
    const map = { Easy: 0, Medium: 0, Hard: 0 };
    questions.forEach((q) => {
      if (map[q.difficulty] !== undefined) map[q.difficulty] += 1;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100)
    }));
  }, [questions]);

  const topStudents = useMemo(() => {
    const map = {};
    results.forEach((r) => {
      const key = r.studentEmail || r.studentName || r.studentId;
      if (!map[key]) map[key] = { name: r.studentName || r.studentEmail || "Student", total: 0, count: 0 };
      map[key].total += Number(r.score || 0);
      map[key].count += 1;
    });
    return Object.values(map)
      .map((s) => ({ ...s, avg: Math.round(s.total / s.count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 6);
  }, [results]);

  async function load() {
    try {
      const [q, e, r, s] = await Promise.all([
        api("/admin/questions", { token }),
        api("/admin/exams", { token }),
        api("/admin/results", { token }),
        api("/admin/students", { token })
      ]);
      setQuestions(q);
      setExams(e);
      setResults(r);
      setStudents(s);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function isActiveExam(exam) {
    if (!exam?.published) return false;
    const now = Date.now();
    if (exam.startDate && now < new Date(exam.startDate).getTime()) return false;
    if (exam.endDate && now > new Date(exam.endDate).getTime()) return false;
    return true;
  }

  function downloadResultsCsv() {
    if (!results.length) return;
    const header = ["Student Name", "Student Email", "Attempt ID", "Exam", "Score", "Time Taken", "Submitted At"];
    const rows = results.map((r) => [
      r.studentName || r.studentEmail || "Unknown",
      r.studentEmail || "",
      r.id || "",
      r.examTitle || r.examId || "",
      r.score ?? 0,
      r.timeTakenMs ? `${Math.floor(r.timeTakenMs / 60000)}m ${Math.floor((r.timeTakenMs % 60000) / 1000)}s` : "-",
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
    <AdminShell title="Dashboard">
      {error && <div className="error">{error}</div>}

      <section className="admin-kpis">
        <div className="kpi-card">
          <span>Total Exams</span>
          <strong>{exams.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Active Exams</span>
          <strong>{exams.filter(isActiveExam).length}</strong>
        </div>
        <div className="kpi-card">
          <span>Total Students</span>
          <strong>{students.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Submissions</span>
          <strong>{results.length}</strong>
        </div>
      </section>

      <section className="card dashboard-card">
        <div className="table-header">
          <div>
            <h3>Quick Actions</h3>
            <p className="muted">Create exams or export results in one click.</p>
          </div>
          <div className="row-actions">
            <button onClick={() => window.location.assign("/admin/exams")}>Quick Create Exam</button>
            <button className="ghost" onClick={downloadResultsCsv}>Export Results (CSV)</button>
          </div>
        </div>
      </section>

      <section className="chart-grid">
        <article className="card chart-card">
          <h3>Scores Over Time</h3>
          <p className="muted">Average score by day (last 10).</p>
          <div className="sparkline-wrap">
            <svg className="sparkline" viewBox="0 0 300 120">
              {scoresByDay.length === 0 && <text x="10" y="60" fill="#7a6ab0">No data</text>}
              {scoresByDay.length > 0 && (
                <polyline
                  fill="none"
                  stroke="url(#grad)"
                  strokeWidth="4"
                  points={scoresByDay.map((d, i) => {
                    const x = (i / Math.max(scoresByDay.length - 1, 1)) * 280 + 10;
                    const max = Math.max(...scoresByDay.map((v) => v.avg), 1);
                    const y = 110 - (d.avg / max) * 90;
                    return `${x},${y}`;
                  }).join(" ")}
                />
              )}
              <defs>
                <linearGradient id="grad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#6f4cff" />
                  <stop offset="100%" stopColor="#9b6bff" />
                </linearGradient>
              </defs>
            </svg>
            <div className="sparkline-labels">
              {scoresByDay.map((d) => (
                <span key={d.day}>{d.day.slice(5)}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="card chart-card">
          <h3>Attempts by Day</h3>
          <p className="muted">Total submissions (last 10).</p>
          <div className="bar-list">
            {attemptsByDay.length === 0 && <div className="empty-item">No data</div>}
            {attemptsByDay.map((d) => (
              <div key={d.day} className="bar-row">
                <span>{d.day.slice(5)}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, d.count * 12)}%` }} />
                </div>
                <strong>{d.count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card chart-card">
          <h3>Average Score per Exam</h3>
          <p className="muted">Top exams by average score.</p>
          <div className="bar-list">
            {avgScoreByExam.length === 0 && <div className="empty-item">No data</div>}
            {avgScoreByExam.map((d) => (
              <div key={d.examId} className="bar-row">
                <span>{d.title}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, d.avg)}%` }} />
                </div>
                <strong>{d.avg}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card chart-card">
          <h3>Difficulty Distribution</h3>
          <p className="muted">Question bank mix.</p>
          <div className="bar-list">
            {difficultyDistribution.map((d) => (
              <div key={d.label} className="bar-row">
                <span>{d.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${d.pct}%` }} />
                </div>
                <strong>{d.pct}%</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card chart-card">
          <h3>Top Students</h3>
          <p className="muted">Highest average scores.</p>
          <div className="bar-list">
            {topStudents.length === 0 && <div className="empty-item">No data</div>}
            {topStudents.map((s) => (
              <div key={s.name} className="bar-row">
                <span>{s.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, s.avg)}%` }} />
                </div>
                <strong>{s.avg}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card dashboard-card">
        <h3>Recent Activity</h3>
        <p className="muted">Latest submitted attempts.</p>
        <ul className="list">
          {results.length === 0 && <li className="empty-item">No recent submissions yet.</li>}
          {[...results]
            .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
            .slice(0, 6)
            .map((r) => (
              <li key={r.id}>
                <div className="item-text">
                  <b>{r.studentName || r.studentEmail || "Student"}</b> submitted{" "}
                  <span className="muted">{r.examTitle || r.examId}</span>
                </div>
                <span className="muted">Score: {r.score ?? 0}</span>
              </li>
            ))}
        </ul>
      </section>
    </AdminShell>
  );
}
