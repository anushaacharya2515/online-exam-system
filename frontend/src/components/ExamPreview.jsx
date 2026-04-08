export default function ExamPreview({ questions }) {
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  return (
    <div className="card">
      <div className="table-header">
        <div>
          <h3>Exam Preview</h3>
          <p className="muted">Review selected questions before saving.</p>
        </div>
        <div className="pill-count">
          {questions.length} Questions | {totalMarks} Marks
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Module</th>
              <th>Topic</th>
              <th>Difficulty</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-cell">No questions selected.</td>
              </tr>
            )}
            {questions.map((q) => (
              <tr key={q.id}>
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
    </div>
  );
}
