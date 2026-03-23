import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { apiClient, withAuth } from "../apiClient";
import { useAuth } from "../context/AuthContext";
import ExamList from "./ExamList";

export default function AdminCreateExam() {
  const { session } = useAuth();
  const token = session.token;
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [mode, setMode] = useState("manual");
  const [examDraft, setExamDraft] = useState({
    examName: "",
    subject: "General",
    durationMinutes: 30,
    totalMarks: "",
    totalQuestions: "",
    startDate: "",
    endDate: "",
    questionIds: [],
    selectionRules: { counts: { Easy: 5, Hard: 2 } }
  });

  async function load() {
    setError("");
    try {
      const res = await apiClient.get("/questions", withAuth(token));
      setQuestions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createExam(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (!examDraft.examName.trim()) {
        setError("Exam name is required.");
        return;
      }
      if (!examDraft.durationMinutes || Number(examDraft.durationMinutes) <= 0) {
        setError("Duration must be greater than 0.");
        return;
      }
      if (mode === "manual" && examDraft.questionIds.length === 0) {
        setError("Select at least one question.");
        return;
      }
      const totalQuestions = mode === "manual"
        ? examDraft.questionIds.length
        : Object.values(examDraft.selectionRules.counts).reduce((sum, v) => sum + Number(v || 0), 0);

      const payload = {
        exam_name: examDraft.examName,
        subject: examDraft.subject || "General",
        duration: Number(examDraft.durationMinutes),
        total_marks: examDraft.totalMarks ? Number(examDraft.totalMarks) : 0,
        total_questions: examDraft.totalQuestions ? Number(examDraft.totalQuestions) : totalQuestions,
        start_date: examDraft.startDate || null,
        end_date: examDraft.endDate || null,
        questions: mode === "manual" ? examDraft.questionIds : [],
        rules: mode === "rules" ? examDraft.selectionRules : null
      };
      if (mode === "rules") {
        await apiClient.post("/exams/generate", payload, withAuth(token));
      } else {
        await apiClient.post("/exams", payload, withAuth(token));
      }
      setExamDraft({
        examName: "",
        subject: "General",
        durationMinutes: 30,
        totalMarks: "",
        totalQuestions: "",
        startDate: "",
        endDate: "",
        questionIds: [],
        selectionRules: { counts: { Easy: 5, Hard: 2 } }
      });
      setSuccess("Exam created successfully.");
      setRefreshToken((v) => v + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  return (
    <AdminShell title="Create Exam">
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form className="card admin-form" onSubmit={createExam}>
        <label>Exam Name</label>
        <input value={examDraft.examName} onChange={(e) => setExamDraft({ ...examDraft, examName: e.target.value })} />

        <label>Duration (minutes)</label>
        <input
          type="number"
          min="1"
          value={examDraft.durationMinutes}
          onChange={(e) => setExamDraft({ ...examDraft, durationMinutes: e.target.value })}
        />

        <div className="row-actions">
          <div>
            <label>Total Marks</label>
            <input type="number" min="0" value={examDraft.totalMarks} onChange={(e) => setExamDraft({ ...examDraft, totalMarks: e.target.value })} />
          </div>
          <div>
            <label>Total Questions</label>
            <input type="number" min="0" value={examDraft.totalQuestions} onChange={(e) => setExamDraft({ ...examDraft, totalQuestions: e.target.value })} />
          </div>
        </div>

        <div className="row-actions">
          <div>
            <label>Start Date</label>
            <input type="datetime-local" value={examDraft.startDate} onChange={(e) => setExamDraft({ ...examDraft, startDate: e.target.value })} />
          </div>
          <div>
            <label>End Date</label>
            <input type="datetime-local" value={examDraft.endDate} onChange={(e) => setExamDraft({ ...examDraft, endDate: e.target.value })} />
          </div>
        </div>

        <div className="row-actions">
          <label>
            <input
              type="radio"
              checked={mode === "manual"}
              onChange={() => setMode("manual")}
            />
            Manual Selection
          </label>
          <label>
            <input
              type="radio"
              checked={mode === "rules"}
              onChange={() => setMode("rules")}
            />
            Auto Generate by Rules
          </label>
        </div>

        {mode === "manual" && (
          <div className="checkbox-list">
            {questions.map((q) => (
              <label key={q.id}>
                <input
                  type="checkbox"
                  checked={examDraft.questionIds.includes(q.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...examDraft.questionIds, q.id]
                      : examDraft.questionIds.filter((id) => id !== q.id);
                    setExamDraft({ ...examDraft, questionIds: next });
                  }}
                />
                {q.text}
              </label>
            ))}
          </div>
        )}

        {mode === "rules" && (
          <div className="row-actions">
            <input
              type="number"
              min="0"
              placeholder="Easy"
              value={examDraft.selectionRules.counts.Easy}
              onChange={(e) => setExamDraft({
                ...examDraft,
                selectionRules: { ...examDraft.selectionRules, counts: { ...examDraft.selectionRules.counts, Easy: Number(e.target.value) } }
              })}
            />
            <input
              type="number"
              min="0"
              placeholder="Hard"
              value={examDraft.selectionRules.counts.Hard}
              onChange={(e) => setExamDraft({
                ...examDraft,
                selectionRules: { ...examDraft.selectionRules, counts: { ...examDraft.selectionRules.counts, Hard: Number(e.target.value) } }
              })}
            />
          </div>
        )}

        <button type="submit">Create Exam</button>
      </form>

      <ExamList refreshToken={refreshToken} />
    </AdminShell>
  );
}
