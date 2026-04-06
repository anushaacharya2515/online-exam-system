import { buildQuestion } from "../services/questionBank.js";
import { Question } from "../models/Question.js";
import { Exam } from "../models/Exam.js";

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      const next = line[i + 1];
      if (next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function toRowObject(headers, values) {
  const row = {};
  headers.forEach((h, idx) => {
    row[h] = (values[idx] ?? "").trim();
  });
  return row;
}

function toQuestionFromCsv(row) {
  const type = (row.type || "MCQ").toUpperCase();
  const options = [
    row.option1,
    row.option2,
    row.option3,
    row.option4
  ].filter(Boolean);

  let correctAnswer = row.answer || row.correct_answer || "";
  if (type === "MSQ") {
    correctAnswer = correctAnswer
      .split(/[|;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (type === "TRUE_FALSE" && options.length === 0) {
    options.push("True", "False");
  }

  return {
    type,
    text: row.question || row.question_text,
    subject: row.subject,
    topic: row.topic || "General",
    difficulty: row.difficulty || "Easy",
    options,
    correctAnswer,
    marks: Number(row.marks || 1)
  };
}

export function listQuestions(req, res) {
  Question.find().lean().then((questions) => res.json(questions));
}

export function searchQuestions(req, res) {
  const keyword = (req.query.keyword || "").toString().trim().toLowerCase();
  if (!keyword) return Question.find().lean().then((questions) => res.json(questions));

  Question.find().lean().then((questions) => {
    const result = questions.filter((q) => {
      const hay = `${q.text || ""} ${q.subject || ""} ${q.topic || ""}`.toLowerCase();
      return hay.includes(keyword);
    });
    res.json(result);
  });
}

export function filterQuestions(req, res) {
  const { subject, difficulty, type } = req.query;
  Question.find({
    ...(subject ? { subject } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(type ? { type } : {})
  }).lean().then((result) => res.json(result));
}

export function createQuestion(req, res) {
  const question = buildQuestion(req.body);
  if (question.error) {
    return res.status(400).json({ message: question.error });
  }
  Question.create(question).then((created) => res.status(201).json(created));
}

export function updateQuestion(req, res) {
  const normalized = {
    ...req.body,
    text: req.body.text ?? req.body.question_text,
    correctAnswer: req.body.correctAnswer ?? req.body.correct_answer,
    subject: req.body.subject ?? req.body.subject_name,
    topic: req.body.topic ?? req.body.topic_name,
    difficulty: req.body.difficulty ?? req.body.level
  };

  Question.findOneAndUpdate(
    { id: req.params.id },
    { ...normalized, updatedAt: new Date().toISOString() },
    { new: true }
  ).then((updated) => {
    if (!updated) return res.status(404).json({ message: "Question not found" });
    res.json(updated);
  });
}

export function deleteQuestion(req, res) {
  Question.deleteOne({ id: req.params.id }).then(async (result) => {
    if (result.deletedCount === 0) return res.status(404).json({ message: "Question not found" });
    await Exam.updateMany({}, { $pull: { questionIds: req.params.id } });
    res.json({ message: "Deleted" });
  });
}

export function uploadCsv(req, res) {
  const csv = req.body?.csv;
  if (!csv || typeof csv !== "string") {
    return res.status(400).json({ message: "csv content is required" });
  }

  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return res.status(400).json({ message: "CSV must include a header and at least one row" });
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const added = [];
  const errors = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row = toRowObject(headers, values);
    const question = buildQuestion(toQuestionFromCsv(row));
    if (question.error) {
      errors.push({ row: i + 1, message: question.error });
      continue;
    }
    added.push(question);
  }

  Question.insertMany(added).then(() => res.json({ added: added.length, errors }));
}
