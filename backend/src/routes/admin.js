import express from "express";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../middleware/auth.js";
import { buildQuestion } from "../services/questionBank.js";
import { Question } from "../models/Question.js";
import { Exam } from "../models/Exam.js";
import { Attempt } from "../models/Attempt.js";
import { User } from "../models/User.js";

const router = express.Router();

router.use(auth("admin"));

router.get("/questions", (req, res) => {
  Question.find().lean().then((questions) => res.json(questions));
});

router.post("/questions", (req, res) => {
  const question = buildQuestion(req.body);
  if (question.error) {
    return res.status(400).json({ message: question.error });
  }
  Question.create(question).then((created) => {
    res.status(201).json(created);
  });
});

router.post("/questions/bulk", (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: "questions array required" });
  }

  const created = [];

  for (const item of questions) {
    const q = buildQuestion(item);
    if (q.error) {
      return res.status(400).json({ message: q.error });
    }
    created.push(q);
  }

  Question.insertMany(created).then(() => res.status(201).json({ count: created.length }));
});


router.put("/questions/:id", (req, res) => {
  Question.findOneAndUpdate(
    { id: req.params.id },
    { ...req.body, updatedAt: new Date().toISOString() },
    { new: true }
  ).then((updated) => {
    if (!updated) return res.status(404).json({ message: "Question not found" });
    res.json(updated);
  });
});

router.delete("/questions/:id", (req, res) => {
  Question.deleteOne({ id: req.params.id }).then(async (result) => {
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Question not found" });
    }
    await Exam.updateMany({}, { $pull: { questionIds: req.params.id } });
    res.json({ message: "Deleted" });
  });
});

router.get("/exams", (req, res) => {
  Exam.find().lean().then((exams) => res.json(exams));
});

router.post("/exams", async (req, res) => {
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
      const pool = await Question.find({
        ...(subject ? { subject } : {}),
        ...(topic ? { topic } : {}),
        difficulty: level
      }).lean();

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

    const candidates = await Question.find({
      ...(subject ? { subject } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(topic ? { topic } : {}),
      ...(marks ? { marks: Number(marks) } : {})
    }).lean();

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

  Exam.create(exam).then((created) => res.status(201).json(created));
});

router.put("/exams/:id", (req, res) => {
  Exam.findOneAndUpdate(
    { id: req.params.id },
    { ...req.body, updatedAt: new Date().toISOString() },
    { new: true }
  ).then((updated) => {
    if (!updated) return res.status(404).json({ message: "Exam not found" });
    res.json(updated);
  });
});

router.get("/results", (req, res) => {
  const { examId } = req.query;
  Promise.all([
    Attempt.find(examId ? { examId } : {}).lean(),
    User.find().lean(),
    Exam.find().lean()
  ]).then(([attempts, users, exams]) => {
    const enriched = attempts.map((a) => {
      const user = users.find((u) => u.id === a.studentId);
      const exam = exams.find((e) => e.id === a.examId);
      const start = a.startedAt ? new Date(a.startedAt).getTime() : null;
      const end = a.submittedAt ? new Date(a.submittedAt).getTime()
        : a.endAt ? new Date(a.endAt).getTime()
        : null;
      const timeTakenMs = start && end ? Math.max(0, end - start) : null;
      return {
        ...a,
        studentName: user?.name || user?.email || "Unknown",
        studentEmail: user?.email || "",
        examTitle: exam?.title || exam?.examName || a.examId,
        timeTakenMs
      };
    });
    res.json(enriched);
  });
});

router.get("/reports/:examId", (req, res) => {
  Promise.all([
    Exam.findOne({ id: req.params.examId }).lean(),
    Attempt.find({ examId: req.params.examId, status: "submitted" }).lean(),
    User.find().lean()
  ]).then(([exam, attempts, users]) => {
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const lines = ["studentEmail,score,submittedAt,attemptId"];
    for (const a of attempts) {
      const user = users.find((u) => u.id === a.studentId);
      lines.push(`${user?.email || "unknown"},${a.score || 0},${a.submittedAt || ""},${a.id}`);
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=report-${exam.id}.csv`);
    res.send(lines.join("\n"));
  });
});

router.get("/students", (req, res) => {
  Promise.all([
    User.find({ role: "student" }).lean(),
    Attempt.find().lean()
  ]).then(([students, attempts]) => {
    const rows = students.map((s) => {
      const userAttempts = attempts.filter((a) => a.studentId === s.id);
      const submitted = userAttempts.filter((a) => a.status === "submitted" || a.submittedAt);
      const uniqueExams = new Set(userAttempts.map((a) => a.examId));
      const avgScore = submitted.length
        ? Math.round(submitted.reduce((sum, a) => sum + Number(a.score || 0), 0) / submitted.length)
        : 0;
      const lastAttempt = userAttempts
        .map((a) => a.submittedAt || a.startedAt || "")
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;

      return {
        id: s.id,
        name: s.name || s.email,
        email: s.email,
        examsTaken: uniqueExams.size,
        averageScore: avgScore,
        lastAttempt
      };
    });

    res.json(rows);
  });
});

export default router;
