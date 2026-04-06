import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import Timer from "../components/Timer";
import NavigationPanel from "../components/NavigationPanel";
import QuestionCard from "../components/QuestionCard";

function hasAnswer(answer) {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "object") {
    const vals = Object.values(answer);
    if (vals.length === 0) return false;
    return vals.some((v) => (Array.isArray(v) ? v.length > 0 : String(v || "").trim().length > 0));
  }
  return true;
}

function toNumberOrEmpty(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function MatchQuestionBoard({ question, value, onChange }) {
  const leftItems = question.pairs?.map((p) => p.left) || [];
  const rightItems = question.pairs?.map((p) => p.right) || [];
  const [selectedLeft, setSelectedLeft] = useState(null);

  const reverseMap = useMemo(() => {
    const map = {};
    Object.entries(value || {}).forEach(([left, right]) => {
      map[right] = left;
    });
    return map;
  }, [value]);

  function connectRight(right) {
    if (!selectedLeft) return;
    onChange({ ...(value || {}), [selectedLeft]: right });
    setSelectedLeft(null);
  }

  function clearLeft(left) {
    const next = { ...(value || {}) };
    delete next[left];
    onChange(next);
  }

  return (
    <div className="match-board">
      <div className="match-col">
        <div className="match-col-title"><span>A</span> Column A</div>
        {leftItems.map((left, idx) => (
          <button
            key={left}
            type="button"
            className={`match-card left ${selectedLeft === left ? "is-selected" : ""}`}
            onClick={() => setSelectedLeft(left)}
          >
            <div className="match-label">Term {idx + 1}</div>
            <div className="match-text">{left}</div>
            <div className="match-dot" />
            {value?.[left] && (
              <small className="match-meta" onClick={(e) => { e.stopPropagation(); clearLeft(left); }}>
                Linked to: {value[left]} (clear)
              </small>
            )}
          </button>
        ))}
      </div>

      <div className="match-middle" aria-hidden>
        <span>{"<->"}</span>
      </div>

      <div className="match-col">
        <div className="match-col-title"><span>B</span> Column B</div>
        {rightItems.map((right, idx) => (
          <button
            key={right}
            type="button"
            className={`match-card right ${reverseMap[right] ? "is-linked" : ""}`}
            onClick={() => connectRight(right)}
          >
            <div className="match-label">Definition {String.fromCharCode(65 + idx)}</div>
            <div className="match-text">{right}</div>
            <div className="match-dot" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DragDropQuestionBoard({ question, value, onChange }) {
  const leftItems = question.pairs?.map((p) => p.left) || [];
  const rightItems = question.pairs?.map((p) => p.right) || [];
  const [dragValue, setDragValue] = useState("");
  const boardRef = useRef(null);
  const leftRefs = useRef({});
  const rightRefs = useRef({});
  const [lines, setLines] = useState([]);

  function onDrop(left) {
    if (!dragValue) return;
    onChange({ ...(value || {}), [left]: dragValue });
    setDragValue("");
  }

  function clearLeft(left) {
    const next = { ...(value || {}) };
    delete next[left];
    onChange(next);
  }

  useEffect(() => {
    function recalc() {
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const nextLines = [];

      Object.entries(value || {}).forEach(([left, right]) => {
        const leftEl = leftRefs.current[left];
        const rightEl = rightRefs.current[right];
        if (!leftEl || !rightEl) return;

        const l = leftEl.getBoundingClientRect();
        const r = rightEl.getBoundingClientRect();
        nextLines.push({
          x1: l.right - boardRect.left,
          y1: l.top + l.height / 2 - boardRect.top,
          x2: r.left - boardRect.left,
          y2: r.top + r.height / 2 - boardRect.top
        });
      });

      setLines(nextLines);
    }

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [value, leftItems, rightItems]);

  return (
    <div className="match-board drag-board" ref={boardRef}>
      <svg className="match-lines" width="100%" height="100%" aria-hidden>
        {lines.map((line, idx) => {
          const c1 = line.x1 + 80;
          const c2 = line.x2 - 80;
          return (
            <path
              key={idx}
              d={`M ${line.x1} ${line.y1} C ${c1} ${line.y1}, ${c2} ${line.y2}, ${line.x2} ${line.y2}`}
            />
          );
        })}
      </svg>
      <div className="match-col">
        <div className="match-col-title"><span>A</span> Drag Targets</div>
        {leftItems.map((left, idx) => (
          <div
            key={left}
            className="match-card left"
            ref={(el) => { leftRefs.current[left] = el; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(left)}
          >
            <div className="match-label">Item {idx + 1}</div>
            <div className="match-text">{left}</div>
            <div className="match-dot" />
            {value?.[left] && (
              <small className="match-meta" onClick={() => clearLeft(left)}>
                Dropped: {value[left]} (clear)
              </small>
            )}
          </div>
        ))}
      </div>

      <div className="match-middle" aria-hidden>
        <span>{"<->"}</span>
      </div>

      <div className="match-col">
        <div className="match-col-title"><span>B</span> Draggable Options</div>
        {rightItems.map((right, idx) => (
          <div
            key={right}
            className="match-card right drag-source"
            ref={(el) => { rightRefs.current[right] = el; }}
            draggable
            onDragStart={() => setDragValue(right)}
          >
            <div className="match-label">Option {String.fromCharCode(65 + idx)}</div>
            <div className="match-text">{right}</div>
            <div className="match-dot" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExamPage() {
  const { attemptId } = useParams();
  const { session } = useAuth();
  const token = session.token;
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [reviewMap, setReviewMap] = useState({});
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const submittedRef = useRef(false);
  const alertShownRef = useRef(false);
  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => hasAnswer(answers[q.id])).length;
  const reviewCount = questions.filter((q) => reviewMap[q.id]).length;

  async function load() {
    try {
      const data = await api(`/student/attempts/${attemptId}`, { token });
      setExam(data.exam);
      setQuestions(data.questions);
      setAnswers(data.attempt.answers || {});
      setRemainingMs(data.remainingMs);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [attemptId]);

  useEffect(() => {
    if (remainingMs <= 0 || submittedRef.current) return;
    const timer = setTimeout(() => {
      setRemainingMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearTimeout(timer);
  }, [remainingMs]);

  useEffect(() => {
    if (remainingMs === 0 && !submittedRef.current && exam) {
      submit(true);
    }
  }, [remainingMs, exam]);

  useEffect(() => {
    if (!exam || alertShownRef.current) return;
    const fiveMinutesMs = 5 * 60 * 1000;
    if (remainingMs > 0 && remainingMs <= fiveMinutesMs) {
      alertShownRef.current = true;
      alert("Only 5 minutes left. Please review and submit your exam.");
    }
  }, [remainingMs, exam]);

  useEffect(() => {
    if (currentIndex > questions.length - 1 && questions.length > 0) {
      setCurrentIndex(questions.length - 1);
    }
  }, [questions.length, currentIndex]);

  async function saveAnswer(questionId, answer) {
    const next = { ...answers, [questionId]: answer };
    setAnswers(next);
    try {
      await api(`/student/attempts/${attemptId}/answers`, { token, method: "PATCH", body: { answers: { [questionId]: answer } } });
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleMsqOption(questionId, optionValue, checked) {
    const prev = Array.isArray(answers[questionId]) ? answers[questionId] : [];
    const next = checked ? [...new Set([...prev, optionValue])] : prev.filter((v) => v !== optionValue);
    saveAnswer(questionId, next);
  }

  async function submit(auto = false) {
    if (submittedRef.current) return;
    submittedRef.current = true;

    try {
      await api(`/student/attempts/${attemptId}/answers`, { token, method: "PATCH", body: { answers } });
      await api(`/student/attempts/${attemptId}/submit`, { token, method: "POST" });
      if (auto) alert("Time is up. Exam auto-submitted.");
      navigate("/student");
    } catch (err) {
      submittedRef.current = false;
      setError(err.message);
    }
  }

  function skipQuestion() {
    if (questions.length === 0) return;
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  }

  function nextQuestion() {
    if (questions.length === 0) return;
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    submit(false);
  }

  function clearCurrentConnections() {
    if (!currentQuestion) return;
    if (currentQuestion.type === "MATCH" || currentQuestion.type === "MATRIX" || currentQuestion.type === "DRAG_DROP") {
      saveAnswer(currentQuestion.id, {});
    }
  }

  function toggleReviewCurrentQuestion() {
    if (!currentQuestion) return;
    setReviewMap((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
  }

  return (
    <div className="exam-shell">
      <header className="exam-topbar">
        <div className="brand">
          <div className="brand-logo">EP</div>
          <strong>ExamPortal</strong>
        </div>
        <nav className="exam-nav">
          <a href="/student" className="muted-link">Dashboard</a>
          <a href="#!" className="active">Current Exam</a>
          <a href="/student/question-bank" className="muted-link">Question Bank</a>
          <a href="#!" className="muted-link">Support</a>
        </nav>
        <div className="exam-user">{session.user.name || session.user.email}</div>
      </header>

      <main className="exam-main">
        <div className="exam-content">
          <div className="exam-breadcrumb">Exams &gt; {exam?.title || "Current Exam"} &gt; Question {Math.max(currentIndex + 1, 1)}</div>
          <div className="exam-stats-row">
            <span>Answered: {answeredCount}/{questions.length}</span>
            <span>Review: {reviewCount}</span>
            <span>Type: {currentQuestion?.type || "-"}</span>
          </div>
          {error && <div className="error">{error}</div>}

          <section className="exam-card-large">
            {!currentQuestion && <div className="empty-block">No questions loaded for this attempt.</div>}

            {currentQuestion && (
              <QuestionCard question={currentQuestion} index={currentIndex} total={questions.length}>

                {currentQuestion.imageUrl && (
                  <div className="media-block">
                    <img src={currentQuestion.imageUrl} alt="Question visual" />
                  </div>
                )}
                {currentQuestion.audioUrl && (
                  <div className="media-block">
                    <audio controls src={currentQuestion.audioUrl} />
                  </div>
                )}
                {currentQuestion.type === "PARAGRAPH_CASE" && <p className="passage">{currentQuestion.passage}</p>}
                {currentQuestion.type === "ASSERTION_REASON" && (
                  <div className="passage">
                    <p><strong>Assertion:</strong> {currentQuestion.assertion}</p>
                    <p><strong>Reason:</strong> {currentQuestion.reason}</p>
                  </div>
                )}

                {["MCQ", "SINGLE_MCQ", "PARAGRAPH_CASE", "ASSERTION_REASON", "TRUE_FALSE", "LOGICAL_REASONING"].includes(currentQuestion.type) && (
                  <div className="option-grid">
                    {(currentQuestion.options || []).map((o, i) => (
                      <label key={i} className="option-card">
                        <input
                          type="radio"
                          name={currentQuestion.id}
                          checked={answers[currentQuestion.id] === o}
                          onChange={() => saveAnswer(currentQuestion.id, o)}
                        />
                        <span className="option-key">{String.fromCharCode(65 + i)}</span>
                        <span className="option-value">{o}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === "FILL_BLANK" && (
                  <input
                    type="text"
                    placeholder="Type your answer"
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => saveAnswer(currentQuestion.id, e.target.value)}
                  />
                )}

                {currentQuestion.type === "MSQ" && (
                  <div className="option-grid">
                    {(currentQuestion.options || []).map((o, i) => (
                      <label key={i} className="option-card">
                        <input
                          type="checkbox"
                          checked={Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].includes(o)}
                          onChange={(e) => toggleMsqOption(currentQuestion.id, o, e.target.checked)}
                        />
                        <span className="option-key">{String.fromCharCode(65 + i)}</span>
                        <span className="option-value">{o}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === "NAT" && (
                  <input
                    type="number"
                    step="any"
                    value={toNumberOrEmpty(answers[currentQuestion.id])}
                    placeholder="Enter numerical answer"
                    onChange={(e) => saveAnswer(currentQuestion.id, e.target.value)}
                  />
                )}

                {currentQuestion.type === "INTEGER_RANGE" && (
                  <input
                    type="number"
                    step="1"
                    value={toNumberOrEmpty(answers[currentQuestion.id])}
                    placeholder={`Enter integer (${currentQuestion.integerRange?.min ?? ""} to ${currentQuestion.integerRange?.max ?? ""})`}
                    onChange={(e) => saveAnswer(currentQuestion.id, e.target.value)}
                  />
                )}

                {currentQuestion.type === "INTEGER" && (
                  <input
                    type="number"
                    step="1"
                    value={toNumberOrEmpty(answers[currentQuestion.id])}
                    placeholder="Enter integer answer"
                    onChange={(e) => saveAnswer(currentQuestion.id, e.target.value)}
                  />
                )}

                {currentQuestion.type === "MATCH" && (
                  <MatchQuestionBoard
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    onChange={(value) => saveAnswer(currentQuestion.id, value)}
                  />
                )}

                {currentQuestion.type === "DRAG_DROP" && (
                  <DragDropQuestionBoard
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    onChange={(value) => saveAnswer(currentQuestion.id, value)}
                  />
                )}

                {currentQuestion.type === "MATRIX" && (
                  <div className="matrix-wrap">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>Rows / Cols</th>
                          {(currentQuestion.matrixCols || []).map((col) => <th key={col}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {(currentQuestion.matrixRows || []).map((row) => (
                          <tr key={row}>
                            <td>{row}</td>
                            {(currentQuestion.matrixCols || []).map((col) => {
                              const checked = Array.isArray(answers[currentQuestion.id]?.[row]) && answers[currentQuestion.id][row].includes(col);
                              return (
                                <td key={`${row}-${col}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const prev = answers[currentQuestion.id] || {};
                                      const rowArr = Array.isArray(prev[row]) ? prev[row] : [];
                                      const nextRow = e.target.checked ? [...new Set([...rowArr, col])] : rowArr.filter((c) => c !== col);
                                      saveAnswer(currentQuestion.id, { ...prev, [row]: nextRow });
                                    }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </QuestionCard>
            )}
          </section>

          <section className="exam-footer-actions">
            <button className="ghost" onClick={clearCurrentConnections}>Clear Connections</button>
            <div className="footer-group">
              <button className="ghost" onClick={toggleReviewCurrentQuestion}>
                {currentQuestion && reviewMap[currentQuestion.id] ? "Unmark Review" : "Mark for Review"}
              </button>
              <button className="ghost" onClick={skipQuestion}>Skip Question</button>
              <button onClick={nextQuestion}>Next Question</button>
              <button className="ghost" onClick={() => submit(false)}>Submit Exam</button>
            </div>
          </section>
        </div>

        <aside className="exam-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Time Remaining</p>
            <Timer remainingMs={remainingMs} />
          </div>

          <NavigationPanel
            questions={questions}
            answers={answers}
            reviewMap={reviewMap}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </aside>
      </main>
    </div>
  );
}
