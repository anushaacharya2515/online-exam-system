import express from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { auth } from "../middleware/auth.js";
import { gradeAttempt } from "../services/grading.js";
import { buildRetakeQuestionSet } from "../services/retakeQuestions.js";

export default function studentRouter(io) {
  const router = express.Router();
  router.use(auth("student"));

  function formatAnswer(answer) {
    if (Array.isArray(answer)) return answer.join(", ");
    if (answer && typeof answer === "object") return JSON.stringify(answer);
    return String(answer ?? "");
  }

  router.get("/exams", (req, res) => {
    const data = db.read();
    const exams = data.exams
      .filter((e) => e.published)
      .map((e) => ({
        id: e.id,
        title: e.title,
        durationMinutes: e.durationMinutes,
        totalQuestions: e.questionIds.length
      }));
    res.json(exams);
  });

  router.get("/question-bank", (req, res) => {
    const data = db.read();
    const publishedExamIds = new Set(data.exams.filter((e) => e.published).flatMap((e) => e.questionIds || []));
    const source = data.questions.filter((q) => publishedExamIds.size === 0 || publishedExamIds.has(q.id));

    const bank = source.slice(0, 50).map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      passage: q.passage || "",
      assertion: q.assertion || "",
      reason: q.reason || "",
      options: q.options || [],
      answer: formatAnswer(q.correctAnswer)
    }));

    res.json(bank);
  });

  router.post("/exams/:examId/start", (req, res) => {
    const data = db.read();
    const exam = data.exams.find((e) => e.id === req.params.examId && e.published);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    const now = Date.now();
    if (exam.startDate && now < new Date(exam.startDate).getTime()) {
      return res.status(403).json({ message: "Exam has not started yet" });
    }
    if (exam.endDate && now > new Date(exam.endDate).getTime()) {
      return res.status(403).json({ message: "Exam has ended" });
    }

    const retakePlan = buildRetakeQuestionSet(data, exam, req.user.userId);

    const endAt = now + exam.durationMinutes * 60 * 1000;

    const attempt = {
      id: uuidv4(),
      examId: exam.id,
      studentId: req.user.userId,
      questionIds: retakePlan.questionIds,
      answers: {},
      status: "in_progress",
      startedAt: new Date(now).toISOString(),
      endAt: new Date(endAt).toISOString(),
      score: null,
      details: [],
      aiGeneratedCount: retakePlan.generatedCount || 0,
      isRetake: retakePlan.isRetake || false
    };

    data.attempts.push(attempt);
    db.write(data);

    res.status(201).json(attempt);
  });

  router.get("/attempts/:attemptId", (req, res) => {
    const data = db.read();
    const attempt = data.attempts.find((a) => a.id === req.params.attemptId && a.studentId === req.user.userId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const exam = data.exams.find((e) => e.id === attempt.examId);
    const questionIds = Array.isArray(attempt.questionIds) && attempt.questionIds.length > 0
      ? attempt.questionIds
      : exam.questionIds;

    const byId = Object.fromEntries(data.questions.map((q) => [q.id, q]));
    const questions = questionIds
      .map((id) => byId[id])
      .filter(Boolean)
      .map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options,
        passage: q.passage,
        pairs: q.pairs,
        matrixRows: q.matrixRows,
        matrixCols: q.matrixCols,
        integerRange: q.integerRange,
        assertion: q.assertion,
        reason: q.reason,
        marks: q.marks
      }));

    const remainingMs = Math.max(0, new Date(attempt.endAt).getTime() - Date.now());
    res.json({ attempt, exam, questions, remainingMs });
  });

  router.patch("/attempts/:attemptId/answers", (req, res) => {
    const { answers } = req.body;
    const data = db.read();
    const idx = data.attempts.findIndex((a) => a.id === req.params.attemptId && a.studentId === req.user.userId);
    if (idx < 0) return res.status(404).json({ message: "Attempt not found" });

    if (data.attempts[idx].status !== "in_progress") {
      return res.status(400).json({ message: "Attempt already submitted" });
    }

    data.attempts[idx].answers = { ...data.attempts[idx].answers, ...(answers || {}) };
    db.write(data);
    res.json({ message: "Saved" });
  });

  router.post("/attempts/:attemptId/submit", (req, res) => {
    const data = db.read();
    const idx = data.attempts.findIndex((a) => a.id === req.params.attemptId && a.studentId === req.user.userId);
    if (idx < 0) return res.status(404).json({ message: "Attempt not found" });

    const attempt = data.attempts[idx];
    if (attempt.status === "submitted") {
      return res.json(attempt);
    }

    const exam = data.exams.find((e) => e.id === attempt.examId);
    const questionIds = Array.isArray(attempt.questionIds) && attempt.questionIds.length > 0
      ? attempt.questionIds
      : exam.questionIds;
    const examQuestions = data.questions.filter((q) => questionIds.includes(q.id));
    const graded = gradeAttempt(examQuestions, attempt.answers || {});

    const submitted = {
      ...attempt,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      score: graded.score,
      details: graded.details
    };

    data.attempts[idx] = submitted;
    db.write(data);

    io.emit("result:submitted", {
      examId: submitted.examId,
      attemptId: submitted.id,
      studentId: submitted.studentId,
      score: submitted.score,
      submittedAt: submitted.submittedAt
    });

    res.json(submitted);
  });

  router.get("/results", (req, res) => {
    const data = db.read();
    const mine = data.attempts.filter((a) => a.studentId === req.user.userId && a.status === "submitted");
    res.json(mine);
  });

  return router;
}
