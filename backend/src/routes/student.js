import express from "express";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../middleware/auth.js";
import { gradeAttempt } from "../services/grading.js";
import { buildRetakeQuestionSetMongo } from "../services/retakeQuestions.js";
import { Exam } from "../models/Exam.js";
import { Question } from "../models/Question.js";
import { Attempt } from "../models/Attempt.js";

export default function studentRouter(io) {
  const router = express.Router();
  router.use(auth("student"));

  function formatAnswer(answer) {
    if (Array.isArray(answer)) return answer.join(", ");
    if (answer && typeof answer === "object") return JSON.stringify(answer);
    return String(answer ?? "");
  }

  router.get("/exams", (req, res) => {
    Exam.find({ published: true }).lean().then((exams) => {
      res.json(exams.map((e) => ({
        id: e.id,
        title: e.title,
        durationMinutes: e.durationMinutes,
        totalQuestions: (e.questionIds || []).length
      })));
    });
  });

  router.get("/question-bank", (req, res) => {
    Promise.all([
      Exam.find({ published: true }, { questionIds: 1 }).lean(),
      Question.find().lean()
    ]).then(([exams, questions]) => {
      const publishedExamIds = new Set(exams.flatMap((e) => e.questionIds || []));
      const source = questions.filter((q) => publishedExamIds.size === 0 || publishedExamIds.has(q.id));
      const bank = source.slice(0, 50).map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        passage: q.passage || "",
        imageUrl: q.imageUrl || "",
        audioUrl: q.audioUrl || "",
        assertion: q.assertion || "",
        reason: q.reason || "",
        options: q.options || [],
        answer: formatAnswer(q.correctAnswer)
      }));
      res.json(bank);
    });
  });

  router.post("/exams/:examId/start", async (req, res) => {
    const exam = await Exam.findOne({ id: req.params.examId, published: true }).lean();
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    const now = Date.now();
    if (exam.startDate && now < new Date(exam.startDate).getTime()) {
      return res.status(403).json({ message: "Exam has not started yet" });
    }
    if (exam.endDate && now > new Date(exam.endDate).getTime()) {
      return res.status(403).json({ message: "Exam has ended" });
    }

    const retakePlan = await buildRetakeQuestionSetMongo(exam, req.user.userId);
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

    await Attempt.create(attempt);
    res.status(201).json(attempt);
  });

  router.get("/attempts/:attemptId", async (req, res) => {
    const attempt = await Attempt.findOne({ id: req.params.attemptId, studentId: req.user.userId }).lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const exam = await Exam.findOne({ id: attempt.examId }).lean();
    const questionIds = Array.isArray(attempt.questionIds) && attempt.questionIds.length > 0
      ? attempt.questionIds
      : exam.questionIds;

    const questions = await Question.find({ id: { $in: questionIds } }).lean();
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
    const ordered = questionIds
      .map((id) => byId[id])
      .filter(Boolean)
      .map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options,
        passage: q.passage,
        imageUrl: q.imageUrl,
        audioUrl: q.audioUrl,
        pairs: q.pairs,
        matrixRows: q.matrixRows,
        matrixCols: q.matrixCols,
        integerRange: q.integerRange,
        assertion: q.assertion,
        reason: q.reason,
        marks: q.marks
      }));

    const remainingMs = Math.max(0, new Date(attempt.endAt).getTime() - Date.now());
    res.json({ attempt, exam, questions: ordered, remainingMs });
  });

  router.patch("/attempts/:attemptId/answers", async (req, res) => {
    const { answers } = req.body;
    const attempt = await Attempt.findOne({ id: req.params.attemptId, studentId: req.user.userId }).lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    if (attempt.status !== "in_progress") {
      return res.status(400).json({ message: "Attempt already submitted" });
    }

    await Attempt.updateOne(
      { id: req.params.attemptId },
      { $set: { answers: { ...attempt.answers, ...(answers || {}) } } }
    );
    res.json({ message: "Saved" });
  });

  router.post("/attempts/:attemptId/submit", async (req, res) => {
    const attempt = await Attempt.findOne({ id: req.params.attemptId, studentId: req.user.userId }).lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    if (attempt.status === "submitted") {
      return res.json(attempt);
    }

    const exam = await Exam.findOne({ id: attempt.examId }).lean();
    const questionIds = Array.isArray(attempt.questionIds) && attempt.questionIds.length > 0
      ? attempt.questionIds
      : exam.questionIds;
    const examQuestions = await Question.find({ id: { $in: questionIds } }).lean();
    const graded = gradeAttempt(examQuestions, attempt.answers || {});

    const submitted = {
      ...attempt,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      score: graded.score,
      details: graded.details
    };

    await Attempt.updateOne({ id: attempt.id }, submitted);

    io.emit("result:submitted", {
      examId: submitted.examId,
      attemptId: submitted.id,
      studentId: submitted.studentId,
      score: submitted.score,
      submittedAt: submitted.submittedAt
    });

    res.json(submitted);
  });

  router.get("/results", async (req, res) => {
    const mine = await Attempt.find({ studentId: req.user.userId, status: "submitted" }).lean();
    res.json(mine);
  });

  return router;
}
