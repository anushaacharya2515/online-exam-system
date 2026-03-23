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

export default function NavigationPanel({ questions, answers, reviewMap, currentIndex, onSelect }) {
  return (
    <div className="sidebar-card">
      <h3>Question Navigator</h3>
      <p className="muted">Questions: {questions.length}</p>
      <div className="nav-grid">
        {questions.map((q, idx) => {
          let status = "unanswered";
          if (hasAnswer(answers[q.id])) status = "completed";
          if (reviewMap[q.id]) status = "review";
          if (idx === currentIndex) status = `current ${status}`;
          return (
            <button
              key={q.id}
              type="button"
              className={`q-nav-btn ${status}`}
              onClick={() => onSelect(idx)}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span><i className="dot completed" /> Answered</span>
        <span><i className="dot review" /> Marked for Review</span>
        <span><i className="dot unanswered" /> Unanswered</span>
      </div>
    </div>
  );
}
