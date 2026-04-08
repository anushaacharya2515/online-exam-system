import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { apiClient, withAuth } from "../apiClient";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import TopicManager from "../components/TopicManager";

export default function ManageModules() {
  const { session } = useAuth();
  const token = session.token;

  const [modules, setModules] = useState([]);
  const [allTopics, setAllTopics] = useState([]);
  const [allSubtopics, setAllSubtopics] = useState([]);

  const [moduleName, setModuleName] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [showTopicModal, setShowTopicModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadModules() {
    const res = await apiClient.get("/modules", withAuth(token));
    setModules(res.data || []);
  }

  async function loadAllTopics() {
    const res = await apiClient.get("/topics", withAuth(token));
    setAllTopics(res.data || []);
  }

  async function loadAllSubtopics() {
    const res = await apiClient.get("/subtopics", withAuth(token));
    setAllSubtopics(res.data || []);
  }

  useEffect(() => {
    loadModules();
    loadAllTopics();
    loadAllSubtopics();
  }, []);

  async function addModule(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!moduleName.trim()) return setError("Module name is required");
    setLoading(true);
    try {
      await apiClient.post("/modules", { name: moduleName }, withAuth(token));
      setModuleName("");
      setMessage("Module added");
      loadModules();
      loadAllTopics();
      loadAllSubtopics();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeModule(id) {
    await apiClient.delete(`/modules/${id}`, withAuth(token));
    loadModules();
    loadAllTopics();
    loadAllSubtopics();
  }

  const topicMap = useMemo(() => {
    const map = {};
    allTopics.forEach((t) => {
      if (!map[t.moduleId]) map[t.moduleId] = [];
      map[t.moduleId].push(t);
    });
    return map;
  }, [allTopics]);

  const subMap = useMemo(() => {
    const map = {};
    allSubtopics.forEach((s) => {
      if (!map[s.topicId]) map[s.topicId] = [];
      map[s.topicId].push(s);
    });
    return map;
  }, [allSubtopics]);

  return (
    <AdminShell title="Manage Modules">
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <section className="grid two">
        <form className="card admin-form" onSubmit={addModule}>
          <h3>Add Module</h3>
          <input value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Module name" />
          <button type="submit" disabled={loading}>Add Module</button>
          <ul className="list">
            {modules.map((m) => (
              <li key={m._id}>
                <span>{m.name}</span>
                <button type="button" className="ghost" onClick={() => removeModule(m._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </form>

        <div className="card admin-form">
          <h3>Manage Topics</h3>
          <label>Module</label>
          <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}>
            <option value="">Select Module</option>
            {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
          <button
            type="button"
            className="primary"
            disabled={!selectedModule}
            onClick={() => setShowTopicModal(true)}
          >
            + Add Topic
          </button>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Hierarchy</h3>
          <p className="muted">Module -> Topic -> Subtopic</p>
          <ul className="list">
            {modules.map((m) => (
              <li key={m._id}>
                <div className="item-text">
                  <b>{m.name}</b>
                  <ul className="list">
                    {(topicMap[m._id] || []).map((t) => (
                      <li key={t._id}>
                        <div className="item-text">
                          {t.name}
                          <ul className="list">
                            {(subMap[t._id] || []).map((s) => (
                              <li key={s._id}>{s.name}</li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Modal
        open={showTopicModal}
        title="Manage Topics"
        onClose={() => {
          setShowTopicModal(false);
          loadAllTopics();
          loadAllSubtopics();
        }}
      >
        <TopicManager token={token} moduleId={selectedModule} />
      </Modal>
    </AdminShell>
  );
}
