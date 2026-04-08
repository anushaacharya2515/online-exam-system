import { useEffect, useMemo, useState } from "react";
import { apiClient, withAuth } from "../apiClient";
import { DIFFICULTY_OPTIONS } from "../pages/questionBankData";

export default function QuestionSelectorModal({
  open,
  token,
  moduleId,
  topicId,
  subTopicId,
  selectedIds,
  onClose,
  onConfirm
}) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [filters, setFilters] = useState({
    moduleId: "",
    topicId: "",
    subTopicId: "",
    difficulty: "",
    type: ""
  });

  useEffect(() => {
    if (!open) return;
    apiClient.get("/modules", withAuth(token)).then((res) => setModules(res.data || []));
  }, [open, token]);

  useEffect(() => {
    if (!filters.moduleId) {
      setTopics([]);
      return;
    }
    apiClient
      .get("/topics", { ...withAuth(token), params: { moduleId: filters.moduleId } })
      .then((res) => setTopics(res.data || []));
  }, [filters.moduleId, token]);

  useEffect(() => {
    if (!filters.topicId) {
      setSubtopics([]);
      return;
    }
    apiClient
      .get("/subtopics", { ...withAuth(token), params: { topicId: filters.topicId } })
      .then((res) => setSubtopics(res.data || []));
  }, [filters.topicId, token]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient
      .get("/questions", {
        ...withAuth(token),
        params: {
          moduleId: filters.moduleId || undefined,
          topicId: filters.topicId || undefined,
          subTopicId: filters.subTopicId || undefined,
          difficulty: filters.difficulty || undefined,
          type: filters.type || undefined
        }
      })
      .then((res) => setQuestions(res.data || []))
      .finally(() => setLoading(false));
  }, [open, token, filters]);

  const [localSelected, setLocalSelected] = useState([]);

  useEffect(() => {
    setLocalSelected(selectedIds || []);
    if (open) {
      setFilters((prev) => ({
        ...prev,
        moduleId: moduleId || "",
        topicId: topicId || "",
        subTopicId: subTopicId || ""
      }));
    }
  }, [selectedIds, open, moduleId, topicId, subTopicId]);

  const totalMarks = useMemo(() => {
    return questions
      .filter((q) => localSelected.includes(q.id))
      .reduce((sum, q) => sum + (q.marks || 0), 0);
  }, [questions, localSelected]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Select Questions</h3>
            <p className="muted">Choose questions to add to this exam.</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">
          <div className="row-actions">
            <div>
              <label>Module</label>
              <select
                value={filters.moduleId}
                onChange={(e) => setFilters({ ...filters, moduleId: e.target.value, topicId: "", subTopicId: "" })}
              >
                <option value="">All Modules</option>
                {modules.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Topic</label>
              <select
                value={filters.topicId}
                onChange={(e) => setFilters({ ...filters, topicId: e.target.value, subTopicId: "" })}
              >
                <option value="">All Topics</option>
                {topics.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row-actions">
            <div>
              <label>Subtopic</label>
              <select
                value={filters.subTopicId}
                onChange={(e) => setFilters({ ...filters, subTopicId: e.target.value })}
              >
                <option value="">All Subtopics</option>
                {subtopics.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Difficulty</label>
              <select
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              >
                <option value="">All</option>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">All</option>
                <option value="MCQ">MCQ</option>
                <option value="MSQ">MSQ</option>
                <option value="NAT">NAT</option>
                <option value="INTEGER_RANGE">INTEGER_RANGE</option>
                <option value="MATCH">MATCH</option>
                <option value="DRAG_DROP">DRAG_DROP</option>
                <option value="TRUE_FALSE">TRUE_FALSE</option>
                <option value="LOGICAL_REASONING">LOGICAL_REASONING</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Question</th>
                  <th>Module</th>
                  <th>Topic</th>
                  <th>Difficulty</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="6" className="empty-cell">Loading...</td>
                  </tr>
                )}
                {!loading && questions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-cell">No questions found.</td>
                  </tr>
                )}
                {!loading && questions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={localSelected.includes(q.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLocalSelected([...localSelected, q.id]);
                          } else {
                            setLocalSelected(localSelected.filter((id) => id !== q.id));
                          }
                        }}
                      />
                    </td>
                    <td>{q.text}</td>
                    <td>{q.subject}</td>
                    <td>{q.topic}</td>
                    <td>{q.difficulty}</td>
                    <td>{q.marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <div className="muted">Selected: {localSelected.length} | Marks: {totalMarks}</div>
            <button type="button" onClick={() => onConfirm(localSelected)}>
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
