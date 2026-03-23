import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import QuestionTable from "../components/QuestionTable";
import { apiClient, withAuth } from "../apiClient";
import { useAuth } from "../context/AuthContext";

const TYPE_OPTIONS = [
  { label: "MCQ", value: "MCQ" },
  { label: "Multiple Select", value: "MSQ" },
  { label: "Fill in the Blank", value: "FILL_BLANK" },
  { label: "Integer Type", value: "INTEGER" },
  { label: "Matching", value: "MATCH" },
  { label: "Drag and Drop", value: "DRAG_DROP" },
  { label: "True / False", value: "TRUE_FALSE" }
];

const TYPE_HELP = {
  MCQ: "One correct option from A/B/C/D.",
  MSQ: "More than one correct option allowed.",
  FILL_BLANK: "Student types the correct text.",
  INTEGER: "Student types an integer number.",
  MATCH: "Left items matched to right items.",
  DRAG_DROP: "Student arranges items in correct order.",
  TRUE_FALSE: "Student chooses True or False."
};

function parsePairs(text) {
  return text
    .split("\n")
    .map((line) => {
      const [left, right] = line.split("|");
      return { left: (left || "").trim(), right: (right || "").trim() };
    })
    .filter((p) => p.left && p.right);
}

function pairsToText(pairs) {
  if (!Array.isArray(pairs)) return "";
  return pairs.map((p) => `${p.left}|${p.right}`).join("\n");
}

function buildDragDropPairs(orderText) {
  const items = orderText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return items.map((item, idx) => ({ left: `Slot ${idx + 1}`, right: item }));
}

export default function QuestionBank() {
  const { session } = useAuth();
  const token = session.token;
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ difficulty: "", type: "" });
  const [modalMode, setModalMode] = useState(null); // add | edit | preview
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [form, setForm] = useState({
    text: "",
    subject: "",
    topic: "",
    difficulty: "Easy",
    type: "MCQ",
    options: ["", "", "", ""],
    correctAnswer: "",
    msqCorrect: [],
    pairText: "",
    dragOrderText: "",
    marks: 1
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

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch = search
        ? `${q.text || q.question_text || ""} ${q.subject || ""} ${q.topic || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true;
      const matchesDifficulty = filters.difficulty ? q.difficulty === filters.difficulty : true;
      const matchesType = filters.type ? q.type === filters.type : true;
      return matchesSearch && matchesDifficulty && matchesType;
    });
  }, [questions, search, filters]);

  function openAddModal() {
    setActiveQuestion(null);
    setForm({
      text: "",
      subject: "General",
      topic: "General",
      difficulty: "Easy",
      type: "MCQ",
      options: ["", "", "", ""],
      correctAnswer: "",
      msqCorrect: [],
      pairText: "",
      dragOrderText: "",
      marks: 1
    });
    setModalMode("add");
  }

  function openEditModal(question) {
    setActiveQuestion(question);
    setForm({
      text: question.text || question.question_text || "",
      subject: question.subject || "General",
      topic: question.topic || "General",
      difficulty: question.difficulty || "Easy",
      type: question.type || "MCQ",
      options: Array.isArray(question.options) && question.options.length ? question.options : ["", "", "", ""],
      correctAnswer: typeof question.correctAnswer === "string" || typeof question.correctAnswer === "number" ? String(question.correctAnswer) : "",
      msqCorrect: Array.isArray(question.correctAnswer) ? question.correctAnswer : [],
      pairText: pairsToText(question.pairs),
      dragOrderText: Array.isArray(question.pairs)
        ? question.pairs.map((p) => p.right).join("\n")
        : "",
      marks: question.marks || 1
    });
    setModalMode("edit");
  }

  function openPreviewModal(question) {
    setActiveQuestion(question);
    setModalMode("preview");
  }

  function closeModal() {
    setModalMode(null);
    setActiveQuestion(null);
  }

  function updateOption(idx, value) {
    const next = [...form.options];
    next[idx] = value;
    setForm({ ...form, options: next });
  }

  function addOption() {
    setForm({ ...form, options: [...form.options, ""] });
  }

  function validate() {
    if (!form.text.trim()) return "Question text is required";
    if (!form.marks || Number.isNaN(Number(form.marks))) return "Marks must be numeric";

    if (form.type === "MCQ") {
      const options = form.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) return "MCQ must have at least 2 options";
      if (!form.correctAnswer) return "Correct answer is required";
      if (!options.includes(form.correctAnswer)) return "Correct answer must be one of the options";
    }

    if (form.type === "MSQ") {
      const options = form.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) return "Multiple Select must have at least 2 options";
      if (form.msqCorrect.length === 0) return "Select at least one correct option";
    }

    if (form.type === "FILL_BLANK") {
      if (!form.correctAnswer.trim()) return "Correct answer is required";
    }

    if (form.type === "INTEGER") {
      if (form.correctAnswer === "") return "Correct integer answer is required";
      if (!Number.isInteger(Number(form.correctAnswer))) return "Answer must be an integer";
    }

    if (form.type === "MATCH") {
      const pairs = parsePairs(form.pairText);
      if (pairs.length === 0) return "Enter matching pairs using Left|Right per line";
    }

    if (form.type === "DRAG_DROP") {
      const pairs = buildDragDropPairs(form.dragOrderText);
      if (pairs.length === 0) return "Enter ordered items for drag and drop";
    }

    if (form.type === "TRUE_FALSE") {
      if (!form.correctAnswer) return "Select the correct answer";
    }

    return "";
  }

  async function saveQuestion(e) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    const options = form.options.map((o) => o.trim()).filter(Boolean);
    let payload = {
      text: form.text,
      subject: form.subject,
      topic: form.topic,
      difficulty: form.difficulty,
      type: form.type,
      marks: Number(form.marks || 1),
      options
    };

    if (form.type === "MCQ") {
      payload = { ...payload, correctAnswer: form.correctAnswer };
    }

    if (form.type === "MSQ") {
      payload = { ...payload, correctAnswer: form.msqCorrect };
    }

    if (form.type === "FILL_BLANK") {
      payload = { ...payload, correctAnswer: form.correctAnswer };
    }

    if (form.type === "INTEGER") {
      payload = { ...payload, correctAnswer: Number(form.correctAnswer) };
    }

    if (form.type === "MATCH") {
      const pairs = parsePairs(form.pairText);
      const correctAnswer = pairs.reduce((acc, p) => {
        acc[p.left] = p.right;
        return acc;
      }, {});
      payload = { ...payload, pairs, correctAnswer };
    }

    if (form.type === "DRAG_DROP") {
      const pairs = buildDragDropPairs(form.dragOrderText);
      const correctAnswer = pairs.reduce((acc, p) => {
        acc[p.left] = p.right;
        return acc;
      }, {});
      payload = { ...payload, pairs, correctAnswer };
    }

    if (form.type === "TRUE_FALSE") {
      payload = { ...payload, options: ["True", "False"], correctAnswer: form.correctAnswer };
    }

    try {
      if (modalMode === "edit" && activeQuestion) {
        await apiClient.put(`/questions/${activeQuestion.id}`, payload, withAuth(token));
      } else {
        await apiClient.post("/questions", payload, withAuth(token));
      }
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function removeQuestion(id) {
    if (!window.confirm("Delete this question?")) return;
    try {
      await apiClient.delete(`/questions/${id}`, withAuth(token));
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function handleSearch() {
    if (!search.trim()) {
      load();
      return;
    }
    try {
      const res = await apiClient.get(`/questions/search?keyword=${encodeURIComponent(search)}`, withAuth(token));
      setQuestions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function applyFilters() {
    try {
      const params = new URLSearchParams();
      if (filters.difficulty) params.append("difficulty", filters.difficulty);
      if (filters.type) params.append("type", filters.type);
      const res = await apiClient.get(`/questions/filter?${params.toString()}`, withAuth(token));
      setQuestions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function resetFilters() {
    setFilters({ difficulty: "", type: "" });
    setSearch("");
    load();
  }

  return (
    <AdminShell title="Question Bank">
      {error && <div className="error">{error}</div>}

      <div className="table-header">
        <div className="search-row">
          <input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="ghost" onClick={handleSearch}>Search</button>
        </div>
        <div className="row-actions">
          <button onClick={openAddModal}>Add Question</button>
        </div>
      </div>

      <div className="filter-row">
        <select value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
          <option value="">All Difficulty</option>
          <option value="Easy">Easy</option>
          <option value="Hard">Hard</option>
        </select>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className="ghost" onClick={applyFilters}>Apply Filters</button>
        <button className="ghost" onClick={resetFilters}>Reset</button>
      </div>

      <QuestionTable
        questions={filteredQuestions}
        onEdit={openEditModal}
        onDelete={removeQuestion}
        onPreview={openPreviewModal}
      />

      {modalMode && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === "preview" ? "Question Preview" : modalMode === "edit" ? "Edit Question" : "Add Question"}</h3>
              <button className="ghost" onClick={closeModal}>Close</button>
            </div>

            {modalMode === "preview" && activeQuestion && (
              <div className="modal-body">
                <h4>{activeQuestion.text}</h4>
                <p className="muted">{activeQuestion.subject} | {activeQuestion.topic} | {activeQuestion.difficulty}</p>
                {Array.isArray(activeQuestion.options) && activeQuestion.options.length > 0 && (
                  <ul className="preview-options">
                    {activeQuestion.options.map((o) => <li key={o}>{o}</li>)}
                  </ul>
                )}
                {activeQuestion.pairs && (
                  <div className="preview-pairs">
                    {(activeQuestion.pairs || []).map((p) => (
                      <div key={`${p.left}-${p.right}`}>{p.left} → {p.right}</div>
                    ))}
                  </div>
                )}
                {activeQuestion.correctAnswer && (
                  <p><strong>Correct:</strong> {Array.isArray(activeQuestion.correctAnswer) ? activeQuestion.correctAnswer.join(", ") : String(activeQuestion.correctAnswer)}</p>
                )}
              </div>
            )}

            {(modalMode === "add" || modalMode === "edit") && (
              <form className="modal-body" onSubmit={saveQuestion}>
                <div className="form-step">
                  <h4>Step 1: Basic Details</h4>
                  <label>Question Text</label>
                  <textarea
                    placeholder="Example: What is the capital of India?"
                    value={form.text}
                    onChange={(e) => setForm({ ...form, text: e.target.value })}
                  />

                  <div className="row-actions">
                    <div>
                      <label>Difficulty</label>
                      <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                        <option value="Easy">Easy</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label>Marks</label>
                      <input type="number" min="1" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="form-step">
                  <h4>Step 2: Question Type</h4>
                  <div className="type-grid">
                    {TYPE_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={`type-pill ${form.type === t.value ? "active" : ""}`}
                        onClick={() => setForm({ ...form, type: t.value, correctAnswer: "", msqCorrect: [], pairText: "", dragOrderText: "" })}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="hint">{TYPE_HELP[form.type]}</p>
                </div>

                <div className="form-step">
                  <h4>Step 3: Answers</h4>

                {(form.type === "MCQ" || form.type === "MSQ") && (
                  <>
                    <label>Options</label>
                    {form.options.map((o, idx) => (
                      <input
                        key={idx}
                        placeholder={`Option ${idx + 1}`}
                        value={o}
                        onChange={(e) => updateOption(idx, e.target.value)}
                      />
                    ))}
                    <button type="button" className="ghost" onClick={addOption}>Add Option</button>
                  </>
                )}

                {form.type === "MCQ" && (
                  <>
                    <label>Correct Answer</label>
                    <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}>
                      <option value="">Select correct option</option>
                      {form.options.filter(Boolean).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </>
                )}

                {form.type === "MSQ" && (
                  <>
                    <label>Correct Answers</label>
                    <div className="checkbox-list">
                      {form.options.filter(Boolean).map((o) => (
                        <label key={o}>
                          <input
                            type="checkbox"
                            checked={form.msqCorrect.includes(o)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.msqCorrect, o]
                                : form.msqCorrect.filter((v) => v !== o);
                              setForm({ ...form, msqCorrect: next });
                            }}
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {form.type === "FILL_BLANK" && (
                  <>
                    <label>Correct Answer</label>
                    <input value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
                  </>
                )}

                {form.type === "INTEGER" && (
                  <>
                    <label>Correct Integer Answer</label>
                    <input type="number" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
                  </>
                )}

                {form.type === "MATCH" && (
                  <>
                    <label>Pairs (Left|Right per line)</label>
                    <textarea value={form.pairText} onChange={(e) => setForm({ ...form, pairText: e.target.value })} />
                  </>
                )}

                {form.type === "DRAG_DROP" && (
                  <>
                    <label>Items in Correct Order (one per line)</label>
                    <textarea value={form.dragOrderText} onChange={(e) => setForm({ ...form, dragOrderText: e.target.value })} />
                  </>
                )}

                {form.type === "TRUE_FALSE" && (
                  <>
                    <label>Correct Answer</label>
                    <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}>
                      <option value="">Select</option>
                      <option value="True">True</option>
                      <option value="False">False</option>
                    </select>
                  </>
                )}

                </div>
                <button type="submit">{modalMode === "edit" ? "Update Question" : "Save Question"}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
