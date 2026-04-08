import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { apiClient, withAuth } from "../apiClient";
import { useAuth } from "../context/AuthContext";
import ExamList from "./ExamList";
import { DIFFICULTY_OPTIONS } from "./questionBankData";
import QuestionSelectorModal from "../components/QuestionSelectorModal";
import ExamPreview from "../components/ExamPreview";
import Dropdowns from "../components/Dropdowns";

export default function AdminCreateExam() {
  const { session } = useAuth();
  const token = session.token;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [mode, setMode] = useState("auto");
  const [showSelector, setShowSelector] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingSubtopics, setLoadingSubtopics] = useState(false);
  const [examDraft, setExamDraft] = useState({
    examName: "",
    moduleId: "",
    topicId: "",
    subTopicId: "",
    durationMinutes: 30,
    startDate: "",
    endDate: "",
    selectionRules: { counts: { Easy: 5, Medium: 3, Hard: 2 } }
  });

  const totalSelectedMarks = useMemo(
    () => previewQuestions.reduce((sum, q) => sum + (q.marks || 0), 0),
    [previewQuestions]
  );

  const totalSelectedQuestions = previewQuestions.length;

  useEffect(() => {
    if (mode === "manual" && selectedIds.length === 0) {
      setPreviewQuestions([]);
    }
  }, [mode, selectedIds]);

  useEffect(() => {
    setLoadingModules(true);
    apiClient
      .get("/modules", withAuth(token))
      .then((res) => setModules(res.data || []))
      .finally(() => setLoadingModules(false));
  }, []);

  useEffect(() => {
    if (!examDraft.moduleId) {
      setTopics([]);
      setSubtopics([]);
      return;
    }
    setLoadingTopics(true);
    apiClient
      .get("/topics", { ...withAuth(token), params: { moduleId: examDraft.moduleId } })
      .then((res) => setTopics(res.data || []))
      .finally(() => setLoadingTopics(false));
  }, [examDraft.moduleId]);

  useEffect(() => {
    if (!examDraft.topicId) {
      setSubtopics([]);
      return;
    }
    setLoadingSubtopics(true);
    apiClient
      .get("/subtopics", { ...withAuth(token), params: { topicId: examDraft.topicId } })
      .then((res) => setSubtopics(res.data || []))
      .finally(() => setLoadingSubtopics(false));
  }, [examDraft.topicId]);

  async function generatePreview() {
    setError("");
    setSuccess("");
    setLoadingPreview(true);
    try {
      const payload = {
        name: examDraft.examName,
        duration: Number(examDraft.durationMinutes),
        moduleId: examDraft.moduleId || null,
        topicId: examDraft.topicId || null,
        subTopicId: examDraft.subTopicId || null,
        easyCount: Number(examDraft.selectionRules.counts.Easy || 0),
        mediumCount: Number(examDraft.selectionRules.counts.Medium || 0),
        hardCount: Number(examDraft.selectionRules.counts.Hard || 0),
        preview: true
      };
      const res = await apiClient.post("/exams/auto-generate", payload, withAuth(token));
      setPreviewQuestions(res.data.questions || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function saveAutoExam(e) {
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
      const payload = {
        name: examDraft.examName,
        duration: Number(examDraft.durationMinutes),
        moduleId: examDraft.moduleId || null,
        topicId: examDraft.topicId || null,
        subTopicId: examDraft.subTopicId || null,
        easyCount: Number(examDraft.selectionRules.counts.Easy || 0),
        mediumCount: Number(examDraft.selectionRules.counts.Medium || 0),
        hardCount: Number(examDraft.selectionRules.counts.Hard || 0),
        startDate: examDraft.startDate || null,
        endDate: examDraft.endDate || null
      };
      await apiClient.post("/exams/auto-generate", payload, withAuth(token));
      setExamDraft({
        examName: "",
        moduleId: "",
        topicId: "",
        subTopicId: "",
        durationMinutes: 30,
        startDate: "",
        endDate: "",
        selectionRules: { counts: { Easy: 5, Medium: 3, Hard: 2 } }
      });
      setPreviewQuestions([]);
      setSuccess("Exam created successfully.");
      setRefreshToken((v) => v + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function saveManualExam(e) {
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
      if (selectedIds.length === 0) {
        setError("Please select at least one question.");
        return;
      }
      const payload = {
        name: examDraft.examName,
        duration: Number(examDraft.durationMinutes),
        selectedQuestions: selectedIds,
        startDate: examDraft.startDate || null,
        endDate: examDraft.endDate || null
      };
      await apiClient.post("/exams/manual", payload, withAuth(token));
      setSelectedIds([]);
      setPreviewQuestions([]);
      setExamDraft({
        examName: "",
        moduleId: "",
        topicId: "",
        subTopicId: "",
        durationMinutes: 30,
        startDate: "",
        endDate: "",
        selectionRules: { counts: { Easy: 5, Medium: 3, Hard: 2 } }
      });
      setSuccess("Exam created successfully.");
      setRefreshToken((v) => v + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function loadSelectedQuestions(ids) {
    if (!ids.length) {
      setPreviewQuestions([]);
      return;
    }
    const res = await apiClient.get("/questions", {
      ...withAuth(token),
      params: { ids: ids.join(",") }
    });
    setPreviewQuestions(res.data || []);
  }

  return (
    <AdminShell title="Create Exam">
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <form className="card admin-form" onSubmit={mode === "auto" ? saveAutoExam : saveManualExam}>
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
            <label>Start Date</label>
            <input type="datetime-local" value={examDraft.startDate} onChange={(e) => setExamDraft({ ...examDraft, startDate: e.target.value })} />
          </div>
          <div>
            <label>End Date</label>
            <input type="datetime-local" value={examDraft.endDate} onChange={(e) => setExamDraft({ ...examDraft, endDate: e.target.value })} />
          </div>
        </div>

        <div className="mode-toggle">
          <label className={`mode-pill ${mode === "auto" ? "active" : ""}`}>
            <input type="radio" checked={mode === "auto"} onChange={() => setMode("auto")} />
            Auto Generate
          </label>
          <label className={`mode-pill ${mode === "manual" ? "active" : ""}`}>
            <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} />
            Manual Selection
          </label>
        </div>

        <Dropdowns
          modules={modules}
          topics={topics}
          subtopics={subtopics}
          moduleId={examDraft.moduleId}
          topicId={examDraft.topicId}
          subTopicId={examDraft.subTopicId}
          loadingModules={loadingModules}
          loadingTopics={loadingTopics}
          loadingSubtopics={loadingSubtopics}
          onModuleChange={(value) => setExamDraft({ ...examDraft, moduleId: value, topicId: "", subTopicId: "" })}
          onTopicChange={(value) => setExamDraft({ ...examDraft, topicId: value, subTopicId: "" })}
          onSubTopicChange={(value) => setExamDraft({ ...examDraft, subTopicId: value })}
        />

        {mode === "auto" && (
          <>
            <div className="count-grid">
              {DIFFICULTY_OPTIONS.map((level) => (
                <div key={level} className="count-field">
                  <label>{level}</label>
                  <input
                    type="number"
                    min="0"
                    value={examDraft.selectionRules.counts[level] ?? 0}
                    onChange={(e) => setExamDraft({
                      ...examDraft,
                      selectionRules: {
                        ...examDraft.selectionRules,
                        counts: { ...examDraft.selectionRules.counts, [level]: Number(e.target.value) }
                      }
                    })}
                  />
                </div>
              ))}
            </div>

            <div className="row-actions">
              <button type="button" className="ghost" onClick={generatePreview}>
                {loadingPreview ? "Generating..." : "Generate Preview"}
              </button>
              <div className="muted">
                Preview: {totalSelectedQuestions} questions | {totalSelectedMarks} marks
              </div>
            </div>
          </>
        )}

        {mode === "manual" && (
          <div className="row-actions">
            <button type="button" className="ghost" onClick={() => setShowSelector(true)}>
              Select Questions
            </button>
            <div className="muted">
              Selected: {selectedIds.length} questions | {totalSelectedMarks} marks
            </div>
          </div>
        )}

        <button type="submit">Save Exam</button>
      </form>

      <ExamPreview questions={previewQuestions} />

      <ExamList refreshToken={refreshToken} />

      <QuestionSelectorModal
        open={showSelector}
        token={token}
        moduleId={examDraft.moduleId}
        topicId={examDraft.topicId}
        subTopicId={examDraft.subTopicId}
        selectedIds={selectedIds}
        onClose={() => setShowSelector(false)}
        onConfirm={(ids) => {
          setSelectedIds(ids);
          setShowSelector(false);
          loadSelectedQuestions(ids);
        }}
      />
    </AdminShell>
  );
}
