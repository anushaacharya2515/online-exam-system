import { db } from "../db.js";
import { buildQuestion } from "../services/questionBank.js";

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
  const data = db.read();
  res.json(data.questions);
}

export function searchQuestions(req, res) {
  const keyword = (req.query.keyword || "").toString().trim().toLowerCase();
  const data = db.read();
  if (!keyword) return res.json(data.questions);

  const result = data.questions.filter((q) => {
    const hay = `${q.text || ""} ${q.subject || ""} ${q.topic || ""}`.toLowerCase();
    return hay.includes(keyword);
  });
  res.json(result);
}

export function filterQuestions(req, res) {
  const { subject, difficulty, type } = req.query;
  const data = db.read();
  const result = data.questions.filter((q) => {
    if (subject && q.subject !== subject) return false;
    if (difficulty && q.difficulty !== difficulty) return false;
    if (type && q.type !== type) return false;
    return true;
  });
  res.json(result);
}

export function createQuestion(req, res) {
  const data = db.read();
  const question = buildQuestion(req.body);
  if (question.error) {
    return res.status(400).json({ message: question.error });
  }
  data.questions.push(question);
  db.write(data);
  res.status(201).json(question);
}

export function updateQuestion(req, res) {
  const data = db.read();
  const idx = data.questions.findIndex((q) => q.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: "Question not found" });

  const normalized = {
    ...req.body,
    text: req.body.text ?? req.body.question_text,
    correctAnswer: req.body.correctAnswer ?? req.body.correct_answer,
    subject: req.body.subject ?? req.body.subject_name,
    topic: req.body.topic ?? req.body.topic_name,
    difficulty: req.body.difficulty ?? req.body.level
  };

  data.questions[idx] = { ...data.questions[idx], ...normalized, updatedAt: new Date().toISOString() };
  db.write(data);
  res.json(data.questions[idx]);
}

export function deleteQuestion(req, res) {
  const data = db.read();
  const before = data.questions.length;
  data.questions = data.questions.filter((q) => q.id !== req.params.id);

  if (before === data.questions.length) {
    return res.status(404).json({ message: "Question not found" });
  }

  data.exams = data.exams.map((ex) => ({
    ...ex,
    questionIds: ex.questionIds.filter((id) => id !== req.params.id)
  }));

  db.write(data);
  res.json({ message: "Deleted" });
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
  const data = db.read();
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

  data.questions.push(...added);
  db.write(data);

  res.json({ added: added.length, errors });
}
