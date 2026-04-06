import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import AdminShell from "../components/AdminShell";

const socket = io("http://localhost:5000", { autoConnect: true });

const ASSERTION_OPTIONS = [
  "A and R are true, R explains A",
  "A and R are true, R does not explain A",
  "A is true, R is false",
  "A is false, R is true"
];

const QUESTION_TYPES = [
  { value: "SINGLE_MCQ", label: "Single Correct MCQ" },
  { value: "MSQ", label: "Multiple Correct (MSQ)" },
  { value: "NAT", label: "Numerical Answer Type (NAT)" },
  { value: "INTEGER_RANGE", label: "Integer Type (Range)" },
  { value: "DRAG_DROP", label: "Drag and Drop Type" },
  { value: "MATRIX", label: "Matrix Matching" },
  { value: "PARAGRAPH_CASE", label: "Paragraph / Case Based" },
  { value: "ASSERTION_REASON", label: "Assertion-Reason" },
  { value: "TRUE_FALSE", label: "True / False" },
  { value: "LOGICAL_REASONING", label: "Logical Reasoning" }
];

function defaultDraft() {
  return {
    type: "SINGLE_MCQ",
    text: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    msqCorrect: [],
    marks: 1,
    subject: "General",
    difficulty: "Easy",
    topic: "General",
    passage: "",
    imageUrl: "",
    audioUrl: "",
    explanation: "",
    integerMin: "",
    integerMax: "",
    matrixRowsText: "",
    matrixColsText: "",
    matrixAnswerText: "",
    dragPairsText: "",
    assertion: "",
    reason: ""
  };
}

function parseMatrixAnswer(text) {
  return text.split("\n").reduce((acc, line) => {
    const [rowRaw, colsRaw] = line.split("|");
    const row = (rowRaw || "").trim();
    if (!row) return acc;
    acc[row] = (colsRaw || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return acc;
  }, {});
}

function parsePairs(text) {
  return text
    .split("\n")
    .map((line) => {
      const [left, right] = line.split("|");
      return { left: (left || "").trim(), right: (right || "").trim() };
    })
    .filter((p) => p.left && p.right);
}

export default function AdminDashboard() {
  const { session } = useAuth();
  const token = session.token;

  const [questions, setQuestions] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [live, setLive] = useState([]);
  const [error, setError] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionDraft, setQuestionDraft] = useState(defaultDraft());
  const [examDraft, setExamDraft] = useState({
    title: "",
    durationMinutes: 30,
    selection: { difficulty: "", marks: "", count: 10 }
  });

  const examById = useMemo(() => Object.fromEntries(exams.map((e) => [e.id, e])), [exams]);

  async function load() {
    try {
      const [q, e, r] = await Promise.all([
        api("/admin/questions", { token }),
        api("/admin/exams", { token }),
        api("/admin/results", { token })
      ]);
      setQuestions(q);
      setExams(e);
      setResults(r);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const onSubmit = (payload) => setLive((prev) => [payload, ...prev].slice(0, 20));
    socket.on("result:submitted", onSubmit);
    return () => socket.off("result:submitted", onSubmit);
  }, []);

  function buildQuestionPayload() {
    const type = questionDraft.type;
    const base = {
      type,
      text: questionDraft.text,
      marks: Number(questionDraft.marks || 1),
      subject: questionDraft.subject,
      difficulty: questionDraft.difficulty,
      topic: questionDraft.topic,
      options: questionDraft.options.map((o) => o.trim()).filter(Boolean),
      passage: questionDraft.passage,
      imageUrl: questionDraft.imageUrl,
      audioUrl: questionDraft.audioUrl,
      explanation: questionDraft.explanation
    };

    if (type === "TRUE_FALSE") {
      return { ...base, options: ["True", "False"], correctAnswer: questionDraft.correctAnswer };
    }

    if (type === "SINGLE_MCQ" || type === "PARAGRAPH_CASE" || type === "LOGICAL_REASONING") {
      return { ...base, correctAnswer: questionDraft.correctAnswer };
    }

    if (type === "ASSERTION_REASON") {
      return {
        ...base,
        options: ASSERTION_OPTIONS,
        assertion: questionDraft.assertion,
        reason: questionDraft.reason,
        correctAnswer: questionDraft.correctAnswer
      };
    }

    if (type === "MSQ") {
      return { ...base, correctAnswer: questionDraft.msqCorrect };
    }

    if (type === "NAT") {
      return { ...base, correctAnswer: Number(questionDraft.correctAnswer) };
    }

    if (type === "INTEGER_RANGE") {
      return {
        ...base,
        correctAnswer: `${questionDraft.integerMin}-${questionDraft.integerMax}`,
        integerRange: {
          min: Number(questionDraft.integerMin),
          max: Number(questionDraft.integerMax)
        }
      };
    }

    if (type === "MATRIX") {
      const matrixRows = questionDraft.matrixRowsText.split(",").map((v) => v.trim()).filter(Boolean);
      const matrixCols = questionDraft.matrixColsText.split(",").map((v) => v.trim()).filter(Boolean);
      return {
        ...base,
        matrixRows,
        matrixCols,
        correctAnswer: parseMatrixAnswer(questionDraft.matrixAnswerText)
      };
    }

    if (type === "DRAG_DROP") {
      const pairs = parsePairs(questionDraft.dragPairsText);
      const correctAnswer = pairs.reduce((acc, p) => {
        acc[p.left] = p.right;
        return acc;
      }, {});
      return {
        ...base,
        pairs,
        correctAnswer
      };
    }

    return { ...base, correctAnswer: questionDraft.correctAnswer };
  }

  async function createQuestion(e) {
    e.preventDefault();
    setError("");

    try {
      const body = buildQuestionPayload();
      if (editingQuestionId) {
        await api(`/admin/questions/${editingQuestionId}`, { token, method: "PUT", body });
      } else {
        await api("/admin/questions", { token, method: "POST", body });
      }
      setEditingQuestionId(null);
      setQuestionDraft(defaultDraft());
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditQuestion(question) {
    setEditingQuestionId(question.id);
    setQuestionDraft({
      type: question.type || "SINGLE_MCQ",
      text: question.text || "",
      options: Array.isArray(question.options) && question.options.length ? question.options : ["", "", "", ""],
      correctAnswer: typeof question.correctAnswer === "string" || typeof question.correctAnswer === "number" ? String(question.correctAnswer) : "",
      msqCorrect: Array.isArray(question.correctAnswer) ? question.correctAnswer : [],
      marks: question.marks || 1,
      subject: question.subject || "General",
      difficulty: question.difficulty || "Easy",
      topic: question.topic || "General",
      passage: question.passage || "",
      integerMin: question.integerRange?.min ?? "",
      integerMax: question.integerRange?.max ?? "",
      matrixRowsText: Array.isArray(question.matrixRows) ? question.matrixRows.join(", ") : "",
      matrixColsText: Array.isArray(question.matrixCols) ? question.matrixCols.join(", ") : "",
      matrixAnswerText: question.type === "MATRIX" && question.correctAnswer
        ? Object.entries(question.correctAnswer).map(([k, v]) => `${k}|${(v || []).join(",")}`).join("\n")
        : "",
      dragPairsText: question.type === "DRAG_DROP" && Array.isArray(question.pairs)
        ? question.pairs.map((p) => `${p.left}|${p.right}`).join("\n")
        : "",
      assertion: question.assertion || "",
      reason: question.reason || ""
    });
  }

  async function removeQuestion(id) {
    await api(`/admin/questions/${id}`, { token, method: "DELETE" });
    load();
  }

  async function createExam(e) {
    e.preventDefault();
    try {
      await api("/admin/exams", { token, method: "POST", body: examDraft });
      setExamDraft({
        title: "",
        durationMinutes: 30,
        selection: { difficulty: "", marks: "", count: 10 }
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadReport(examId) {
    const csv = await api(`/admin/reports/${examId}`, { token });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-report-${examId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showOptions = ["SINGLE_MCQ", "MSQ", "PARAGRAPH_CASE", "LOGICAL_REASONING"].includes(questionDraft.type);

  const selection = examDraft.selection || {};
  const availableCount = questions.filter((q) => {
    if (selection.difficulty && q.difficulty !== selection.difficulty) return false;
    if (selection.marks && Number(q.marks) !== Number(selection.marks)) return false;
    return true;
  }).length;

  return (
    <AdminShell title="Dashboard">
      {error && <div className="error">{error}</div>}

      <section className="admin-kpis">
        <div className="kpi-card">
          <span>Total Questions</span>
          <strong>{questions.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Active Exams</span>
          <strong>{exams.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Submissions</span>
          <strong>{results.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Live Events</span>
          <strong>{live.length}</strong>
        </div>
      </section>

      <section className="grid dashboard-grid">
        <article className="card dashboard-card">
          <h3>Question Bank</h3>
          <p className="muted">Create advanced question types for your exam engine.</p>
          <form onSubmit={createQuestion}>
            <select value={questionDraft.type} onChange={(e) => setQuestionDraft({ ...questionDraft, type: e.target.value })}>
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <textarea placeholder="Question text" value={questionDraft.text} onChange={(e) => setQuestionDraft({ ...questionDraft, text: e.target.value })} />
            <input placeholder="Image URL (optional)" value={questionDraft.imageUrl} onChange={(e) => setQuestionDraft({ ...questionDraft, imageUrl: e.target.value })} />
            <input placeholder="Audio URL (optional)" value={questionDraft.audioUrl} onChange={(e) => setQuestionDraft({ ...questionDraft, audioUrl: e.target.value })} />
            <textarea placeholder="Explanation (optional)" value={questionDraft.explanation} onChange={(e) => setQuestionDraft({ ...questionDraft, explanation: e.target.value })} />

            <select required value={questionDraft.difficulty} onChange={(e) => setQuestionDraft({ ...questionDraft, difficulty: e.target.value })}>
              <option value="Easy">Easy</option>
              <option value="Hard">Hard</option>
            </select>

            {questionDraft.type === "PARAGRAPH_CASE" && (
              <textarea placeholder="Paragraph / Case passage" value={questionDraft.passage} onChange={(e) => setQuestionDraft({ ...questionDraft, passage: e.target.value })} />
            )}

            {questionDraft.type === "ASSERTION_REASON" && (
              <>
                <textarea placeholder="Assertion statement" value={questionDraft.assertion} onChange={(e) => setQuestionDraft({ ...questionDraft, assertion: e.target.value })} />
                <textarea placeholder="Reason statement" value={questionDraft.reason} onChange={(e) => setQuestionDraft({ ...questionDraft, reason: e.target.value })} />
              </>
            )}

            {showOptions && questionDraft.options.map((o, i) => (
              <input
                key={i}
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => {
                  const next = [...questionDraft.options];
                  next[i] = e.target.value;
                  setQuestionDraft({ ...questionDraft, options: next });
                }}
              />
            ))}

            {["SINGLE_MCQ", "PARAGRAPH_CASE", "LOGICAL_REASONING", "TRUE_FALSE"].includes(questionDraft.type) && (
              <select value={questionDraft.correctAnswer} onChange={(e) => setQuestionDraft({ ...questionDraft, correctAnswer: e.target.value })}>
                <option value="">Select correct option</option>
                {(questionDraft.type === "TRUE_FALSE" ? ["True", "False"] : questionDraft.options.filter(Boolean)).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}

            {questionDraft.type === "MSQ" && (
              <div className="checkbox-list">
                {questionDraft.options.filter(Boolean).map((o) => (
                  <label key={o}>
                    <input
                      type="checkbox"
                      checked={questionDraft.msqCorrect.includes(o)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...questionDraft.msqCorrect, o]
                          : questionDraft.msqCorrect.filter((v) => v !== o);
                        setQuestionDraft({ ...questionDraft, msqCorrect: next });
                      }}
                    />
                    {o}
                  </label>
                ))}
              </div>
            )}

            {questionDraft.type === "ASSERTION_REASON" && (
              <select value={questionDraft.correctAnswer} onChange={(e) => setQuestionDraft({ ...questionDraft, correctAnswer: e.target.value })}>
                <option value="">Select correct relation</option>
                {ASSERTION_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}

            {questionDraft.type === "NAT" && (
              <input type="number" placeholder="Correct numerical answer" value={questionDraft.correctAnswer} onChange={(e) => setQuestionDraft({ ...questionDraft, correctAnswer: e.target.value })} />
            )}

            {questionDraft.type === "INTEGER_RANGE" && (
              <div className="row-actions">
                <input type="number" placeholder="Min integer" value={questionDraft.integerMin} onChange={(e) => setQuestionDraft({ ...questionDraft, integerMin: e.target.value })} />
                <input type="number" placeholder="Max integer" value={questionDraft.integerMax} onChange={(e) => setQuestionDraft({ ...questionDraft, integerMax: e.target.value })} />
              </div>
            )}

            {questionDraft.type === "MATRIX" && (
              <>
                <input placeholder="Matrix rows (comma separated)" value={questionDraft.matrixRowsText} onChange={(e) => setQuestionDraft({ ...questionDraft, matrixRowsText: e.target.value })} />
                <input placeholder="Matrix columns (comma separated)" value={questionDraft.matrixColsText} onChange={(e) => setQuestionDraft({ ...questionDraft, matrixColsText: e.target.value })} />
                <textarea placeholder={"Correct map per line: Row|Col1,Col2"} value={questionDraft.matrixAnswerText} onChange={(e) => setQuestionDraft({ ...questionDraft, matrixAnswerText: e.target.value })} />
              </>
            )}

            {questionDraft.type === "DRAG_DROP" && (
              <textarea
                placeholder={"Enter pairs line by line: Left item|Right item"}
                value={questionDraft.dragPairsText}
                onChange={(e) => setQuestionDraft({ ...questionDraft, dragPairsText: e.target.value })}
              />
            )}

            <input type="number" min="1" value={questionDraft.marks} onChange={(e) => setQuestionDraft({ ...questionDraft, marks: Number(e.target.value) })} />
            <button type="submit">{editingQuestionId ? "Update Question" : "Add Question"}</button>
            {editingQuestionId && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditingQuestionId(null);
                  setQuestionDraft(defaultDraft());
                }}
              >
                Cancel Edit
              </button>
            )}
          </form>

          <ul className="list">
            {questions.length === 0 && <li className="empty-item">No questions yet.</li>}
            {questions.map((q) => (
              <li key={q.id}>
                <div className="item-text">
                  <b>{q.type}</b> {q.text}
                  <div className="muted">{q.subject} - {q.topic} - {q.difficulty} - {q.marks} mark(s)</div>
                </div>
                <div className="row-actions">
                  <button className="ghost" onClick={() => startEditQuestion(q)}>Edit</button>
                  <button onClick={() => removeQuestion(q.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="card dashboard-card">
          <h3>Create Exam</h3>
          <p className="muted">Choose criteria and auto-pick questions from the bank.</p>
          <form onSubmit={createExam}>
            <input placeholder="Exam title" value={examDraft.title} onChange={(e) => setExamDraft({ ...examDraft, title: e.target.value })} />
            <input type="number" min="1" value={examDraft.durationMinutes} onChange={(e) => setExamDraft({ ...examDraft, durationMinutes: Number(e.target.value) })} />
            <div className="row-actions">
              <select
                value={selection.difficulty}
                onChange={(e) => setExamDraft({ ...examDraft, selection: { ...selection, difficulty: e.target.value } })}
              >
                <option value="">Any difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Hard">Hard</option>
              </select>
              <input
                type="number"
                min="1"
                placeholder="Marks"
                value={selection.marks}
                onChange={(e) => setExamDraft({ ...examDraft, selection: { ...selection, marks: e.target.value } })}
              />
            </div>

            <input
              type="number"
              min="1"
              placeholder="Number of questions"
              value={selection.count}
              onChange={(e) => setExamDraft({ ...examDraft, selection: { ...selection, count: Number(e.target.value) } })}
            />
            <div className="muted">Available matches: {availableCount}</div>
            <button type="submit">Create Exam</button>
          </form>

          <ul className="list">
            {exams.length === 0 && <li className="empty-item">No exams created yet.</li>}
            {exams.map((e) => (
              <li key={e.id}>
                <div className="item-text">
                  <b>{e.title}</b>
                  <div>{e.durationMinutes} min | {e.questionIds.length} questions</div>
                </div>
                <button onClick={() => downloadReport(e.id)}>Download Report</button>
              </li>
            ))}
          </ul>
        </article>

        <article className="card dashboard-card">
          <h3>Live Submissions</h3>
          <p className="muted">Realtime events from active exam sessions.</p>
          <ul className="list">
            {live.length === 0 && <li className="empty-item">No live submissions right now.</li>}
            {live.map((l) => (
              <li key={l.attemptId}>{l.attemptId.slice(0, 6)}... | score: {l.score} {l.autoSubmitted ? "(auto)" : ""}</li>
            ))}
          </ul>

          <h3>All Results</h3>
          <ul className="list">
            {results.length === 0 && <li className="empty-item">No result data available.</li>}
            {results.map((r) => (
              <li key={r.id}>
                <div>{examById[r.examId]?.title || r.examId}</div>
                <div>Score: {r.score ?? 0}</div>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </AdminShell>
  );
}
