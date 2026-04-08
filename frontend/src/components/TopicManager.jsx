import { useEffect, useMemo, useState } from "react";
import { apiClient, withAuth } from "../apiClient";

export default function TopicManager({ token, moduleId }) {
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState({});
  const [topicName, setTopicName] = useState("");
  const [subInputs, setSubInputs] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!moduleId) {
      setTopics([]);
      setSubtopics({});
      return;
    }
    const res = await apiClient.get("/topics", { ...withAuth(token), params: { moduleId } });
    const topicList = res.data || [];
    setTopics(topicList);

    const pairs = await Promise.all(
      topicList.map(async (t) => {
        const sub = await apiClient.get("/subtopics", { ...withAuth(token), params: { topicId: t._id } });
        return [t._id, sub.data || []];
      })
    );
    const map = {};
    pairs.forEach(([id, list]) => {
      map[id] = list;
    });
    setSubtopics(map);
  }

  useEffect(() => {
    load();
  }, [moduleId]);

  const lowerTopics = useMemo(
    () => topics.map((t) => t.name.trim().toLowerCase()),
    [topics]
  );

  async function addTopic(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    const name = topicName.trim();
    if (!moduleId) return setError("Select a module first");
    if (!name) return setError("Topic name is required");
    if (lowerTopics.includes(name.toLowerCase())) {
      return setError("Topic already exists");
    }
    setLoading(true);
    try {
      await apiClient.post("/topics", { name, moduleId }, withAuth(token));
      setTopicName("");
      setMessage("Topic added");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addSubtopic(topicId) {
    setError("");
    setMessage("");
    const name = (subInputs[topicId] || "").trim();
    if (!name) return setError("Subtopic name is required");
    const existing = (subtopics[topicId] || []).map((s) => s.name.toLowerCase());
    if (existing.includes(name.toLowerCase())) {
      return setError("Subtopic already exists");
    }
    setLoading(true);
    try {
      await apiClient.post("/subtopics", { name, topicId }, withAuth(token));
      setSubInputs((prev) => ({ ...prev, [topicId]: "" }));
      setMessage("Subtopic added");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeTopic(id) {
    await apiClient.delete(`/topics/${id}`, withAuth(token));
    await load();
  }

  async function removeSubtopic(id) {
    await apiClient.delete(`/subtopics/${id}`, withAuth(token));
    await load();
  }

  return (
    <div className="topic-manager">
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <form className="topic-add" onSubmit={addTopic}>
        <input
          placeholder="Add a new topic"
          value={topicName}
          onChange={(e) => setTopicName(e.target.value)}
        />
        <button type="submit" disabled={loading}>Add Topic</button>
      </form>

      <div className="topic-list">
        {topics.length === 0 && <div className="muted">No topics yet.</div>}
        {topics.map((t) => (
          <div key={t._id} className="topic-item">
            <div className="topic-row">
              <strong>{t.name}</strong>
              <div className="topic-actions">
                <button type="button" className="ghost" onClick={() => removeTopic(t._id)}>❌</button>
              </div>
            </div>

            <div className="subtopic-row">
              <input
                placeholder="Add subtopic"
                value={subInputs[t._id] || ""}
                onChange={(e) => setSubInputs((prev) => ({ ...prev, [t._id]: e.target.value }))}
              />
              <button type="button" className="ghost" onClick={() => addSubtopic(t._id)}>
                Add Subtopic
              </button>
            </div>

            <div className="subtopic-list">
              {(subtopics[t._id] || []).map((s) => (
                <div key={s._id} className="subtopic-chip">
                  <span>{s.name}</span>
                  <button type="button" onClick={() => removeSubtopic(s._id)}>❌</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
