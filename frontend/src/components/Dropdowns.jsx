export default function Dropdowns({
  modules,
  topics,
  subtopics,
  moduleId,
  topicId,
  subTopicId,
  onModuleChange,
  onTopicChange,
  onSubTopicChange,
  loadingModules,
  loadingTopics,
  loadingSubtopics
}) {
  return (
    <div className="row-actions">
      <div>
        <label>Module</label>
        <select value={moduleId || ""} onChange={(e) => onModuleChange(e.target.value)}>
          <option value="">{loadingModules ? "Loading..." : "Select Module"}</option>
          {modules.map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Topic</label>
        <select value={topicId || ""} onChange={(e) => onTopicChange(e.target.value)}>
          <option value="">{loadingTopics ? "Loading..." : "Select Topic"}</option>
          {topics.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Subtopic</label>
        <select value={subTopicId || ""} onChange={(e) => onSubTopicChange(e.target.value)}>
          <option value="">{loadingSubtopics ? "Loading..." : "Select Subtopic (optional)"}</option>
          {subtopics.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
