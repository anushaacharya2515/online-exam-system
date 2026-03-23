import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { gradeAttempt } from "../services/grading.js";

function normalizeExamBody(body) {
  return {
    examName: body.exam_name ?? body.examName ?? body.title ?? "",
    subject: body.subject ?? "",
    duration: Number(body.duration ?? body.durationMinutes ?? body.duration_minutes ?? 0),
    totalMarks: Number(body.total_marks ?? body.totalMarks ?? 0),
    totalQuestions: Number(body.total_questions ?? body.totalQuestions ?? 0),
    startDate: body.start_date ?? body.startDate ?? null,
    endDate: body.end_date ?? body.endDate ?? null,
    questionIds: Array.isArray(body.questions ?? body.questionIds) ? (body.questions ?? body.questionIds) : []
  };
}

function isWithinWindow(exam) {
  if (!exam.startDate && !exam.endDate) return true;
  const now = Date.now();
  if (exam.startDate && now < new Date(exam.startDate).getTime()) return false;
  if (exam.endDate && now > new Date(exam.endDate).getTime()) return false;
  return true;
}

function selectByRules(data, rules) {
  const { subject, counts = {}, topic } = rules || {};
  const difficulties = Object.entries(counts).filter(([, count]) => Number(count) > 0);
  if (difficulties.length === 0) {
    return { error: "selection rules must include at least one difficulty count" };
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
      return { error: `Not enough ${level} questions for the selected rules` };
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    picked.push(...shuffled.slice(0, count).map((q) => q.id));
  }

  return { questionIds: picked };
}

export function createExam(req, res) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const data = db.read();
  const norm = normalizeExamBody(req.body);

  if (!norm.examName || !norm.subject || !norm.duration) {
    return res.status(400).json({ message: "exam name, subject, and duration are required" });
  }

  if (!norm.questionIds.length) {
    return res.status(400).json({ message: "At least one question is required" });
  }

  const totalMarks = norm.totalMarks || norm.questionIds
    .map((id) => data.questions.find((q) => q.id === id)?.marks || 0)
    .reduce((sum, v) => sum + v, 0);

  const exam = {
    id: uuidv4(),
    title: norm.examName,
    examName: norm.examName,
    subject: norm.subject,
    durationMinutes: norm.duration,
    totalMarks,
    totalQuestions: norm.totalQuestions || norm.questionIds.length,
    startDate: norm.startDate,
    endDate: norm.endDate,
    questionIds: norm.questionIds,
    published: true,
    createdAt: new Date().toISOString()
  };

  data.exams.push(exam);
  db.write(data);
  res.status(201).json(exam);
}

export function listExams(req, res) {
  const data = db.read();
  if (req.user.role === "admin") {
    return res.json(data.exams);
  }
  const visible = data.exams.filter((e) => e.published && isWithinWindow(e));
  res.json(visible);
}

export function getExam(req, res) {
  const data = db.read();
  const exam = data.exams.find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ message: "Exam not found" });
  if (req.user.role !== "admin" && (!exam.published || !isWithinWindow(exam))) {
    return res.status(403).json({ message: "Exam not available" });
  }
  const questions = data.questions.filter((q) => exam.questionIds.includes(q.id));
  res.json({ ...exam, questions });
}

export function generateExam(req, res) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const data = db.read();
  const norm = normalizeExamBody(req.body);
  const rules = req.body.rules || req.body.selectionRules || {};

  if (!norm.examName || !norm.subject || !norm.duration) {
    return res.status(400).json({ message: "exam name, subject, and duration are required" });
  }

  const picked = selectByRules(data, { subject: norm.subject, topic: rules.topic, counts: rules.counts || rules });
  if (picked.error) return res.status(400).json({ message: picked.error });

  const totalMarks = picked.questionIds
    .map((id) => data.questions.find((q) => q.id === id)?.marks || 0)
    .reduce((sum, v) => sum + v, 0);

  const exam = {
    id: uuidv4(),
    title: norm.examName,
    examName: norm.examName,
    subject: norm.subject,
    durationMinutes: norm.duration,
    totalMarks,
    totalQuestions: picked.questionIds.length,
    startDate: norm.startDate,
    endDate: norm.endDate,
    questionIds: picked.questionIds,
    published: true,
    selectionRules: rules,
    createdAt: new Date().toISOString()
  };

  data.exams.push(exam);
  db.write(data);
  res.status(201).json(exam);
}

export function submitExam(req, res) {
  if (req.user.role !== "student") return res.status(403).json({ message: "Forbidden" });
  const { exam_id, examId, answers } = req.body;
  const examIdResolved = examId || exam_id;
  if (!examIdResolved || !answers) {
    return res.status(400).json({ message: "exam_id and answers are required" });
  }

  const data = db.read();
  const exam = data.exams.find((e) => e.id === examIdResolved);
  if (!exam) return res.status(404).json({ message: "Exam not found" });
  if (!exam.published || !isWithinWindow(exam)) {
    return res.status(403).json({ message: "Exam not available" });
  }

  const existing = data.results.find((r) => r.examId === examIdResolved && r.studentId === req.user.userId);
  if (existing) {
    return res.status(400).json({ message: "Exam already submitted" });
  }

  const examQuestions = data.questions.filter((q) => exam.questionIds.includes(q.id));
  const graded = gradeAttempt(examQuestions, answers);
  const correctCount = graded.details.filter((d) => d.correct).length;
  const wrongCount = graded.details.filter((d) => !d.correct).length;
  const percentage = examQuestions.length ? Math.round((graded.score / (exam.totalMarks || graded.score || 1)) * 100) : 0;

  const result = {
    id: uuidv4(),
    studentId: req.user.userId,
    examId: exam.id,
    correct: correctCount,
    wrong: wrongCount,
    score: graded.score,
    percentage,
    submittedAt: new Date().toISOString()
  };

  data.results.push(result);
  db.write(data);
  res.json(result);
}
