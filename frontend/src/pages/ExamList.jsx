import { useEffect, useState } from "react";
import { apiClient, withAuth } from "../apiClient";
import { useAuth } from "../context/AuthContext";

export default function ExamList({ refreshToken = 0 }) {
  const { session } = useAuth();
  const token = session.token;
  const [exams, setExams] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const res = await apiClient.get("/exams", withAuth(token));
      setExams(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => {
    load();
  }, [refreshToken]);

  return (
    <div className="card">
      <h3>Exam List</h3>
      <p className="muted">All created exams.</p>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Subject</th>
              <th>Duration</th>
              <th>Total Questions</th>
              <th>Total Marks</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-cell">No exams created yet.</td>
              </tr>
            )}
            {exams.map((e) => (
              <tr key={e.id}>
                <td>{e.examName || e.title}</td>
                <td>{e.subject || "-"}</td>
                <td>{e.durationMinutes} min</td>
                <td>{e.totalQuestions || e.questionIds?.length || 0}</td>
                <td>{e.totalMarks || "-"}</td>
                <td>{e.startDate || "-"}</td>
                <td>{e.endDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
