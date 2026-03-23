import express from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";
import { buildQuestion } from "../services/questionBank.js";

const router = express.Router();

router.use(auth("admin"));

router.get("/questions", (req, res) => {
  const data = db.read();
  res.json(data.questions);
});

router.post("/questions", (req, res) => {
  const data = db.read();
  const question = buildQuestion(req.body);
  if (question.error) {
    return res.status(400).json({ message: question.error });
  }
  data.questions.push(question);
  db.write(data);

  res.status(201).json(question);
});

router.post("/questions/bulk", (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: "questions array required" });
  }

  const data = db.read();
  const created = [];

  for (const item of questions) {
    const q = buildQuestion(item);
    if (q.error) {
      return res.status(400).json({ message: q.error });
    }
    created.push(q);
  }

  data.questions.push(...created);
  db.write(data);
  res.status(201).json({ count: created.length });
});


router.put("/questions/:id", (req, res) => {
  const data = db.read();
  const idx = data.questions.findIndex((q) => q.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: "Question not found" });

  data.questions[idx] = { ...data.questions[idx], ...req.body, updatedAt: new Date().toISOString() };
  db.write(data);
  res.json(data.questions[idx]);
});

router.delete("/questions/:id", (req, res) => {
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
});

router.get("/exams", (req, res) => {
  const data = db.read();
  res.json(data.exams);
});

router.post("/exams", (req, res) => {
  const {
    title,
    durationMinutes,
    questionIds = [],
    published = true,
    selection = null,
    selectionRules = null
  } = req.body;
  if (!title || !durationMinutes) {
    return res.status(400).json({ message: "title and durationMinutes are required" });
  }

  const data = db.read();
  let pickedIds = Array.isArray(questionIds) ? questionIds : [];

  if (selectionRules) {
    const { subject, topic, counts = {} } = selectionRules;
    const difficulties = Object.entries(counts).filter(([, count]) => Number(count) > 0);
    if (difficulties.length === 0) {
      return res.status(400).json({ message: "selectionRules.counts must include at least one difficulty" });
    }

    const picked = [];
    for (const [level, countRaw] of difficulties) {
      const count = Number(countRaw);
      const pool = data.questions.filter((q) => {
        if (subject && q.subject !== subject) return false;
        if (topic && q.topic !== topic) return false;
        return q.difficulty === level;
      });

      if (pool.length < count) {
        return res.status(400).json({ message: `Not enough ${level} questions for the selected rules` });
      }

      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      picked.push(...shuffled.slice(0, count).map((q) => q.id));
    }

    pickedIds = picked;
  } else if (selection) {
    const {
      subject,
      difficulty,
      topic,
      marks,
      count
    } = selection;

    if (!count || Number(count) <= 0) {
      return res.status(400).json({ message: "selection.count must be > 0" });
    }

    const candidates = data.questions.filter((q) => {
      if (subject && q.subject !== subject) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (topic && q.topic !== topic) return false;
      if (marks && Number(q.marks) !== Number(marks)) return false;
      return true;
    });

    if (candidates.length < Number(count)) {
      return res.status(400).json({ message: "Not enough questions for the selected criteria" });
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    pickedIds = shuffled.slice(0, Number(count)).map((q) => q.id);
  }

  if (!Array.isArray(pickedIds) || pickedIds.length === 0) {
    return res.status(400).json({ message: "No questions selected for this exam" });
  }

  const exam = {
    id: uuidv4(),
    title,
    durationMinutes: Number(durationMinutes),
    questionIds: pickedIds,
    published,
    selection: selection || null,
    selectionRules: selectionRules || null,
    createdAt: new Date().toISOString()
  };

  data.exams.push(exam);
  db.write(data);
  res.status(201).json(exam);
});

router.put("/exams/:id", (req, res) => {
  const data = db.read();
  const idx = data.exams.findIndex((e) => e.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: "Exam not found" });

  data.exams[idx] = { ...data.exams[idx], ...req.body, updatedAt: new Date().toISOString() };
  db.write(data);
  res.json(data.exams[idx]);
});

router.get("/results", (req, res) => {
  const data = db.read();
  const { examId } = req.query;
  const attempts = examId ? data.attempts.filter((a) => a.examId === examId) : data.attempts;
  res.json(attempts);
});

router.get("/reports/:examId", (req, res) => {
  const data = db.read();
  const exam = data.exams.find((e) => e.id === req.params.examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  const attempts = data.attempts.filter((a) => a.examId === exam.id && a.status === "submitted");
  const lines = ["studentEmail,score,submittedAt,attemptId"];

  for (const a of attempts) {
    const user = data.users.find((u) => u.id === a.studentId);
    lines.push(`${user?.email || "unknown"},${a.score || 0},${a.submittedAt || ""},${a.id}`);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=report-${exam.id}.csv`);
  res.send(lines.join("\n"));
});

export default router;
