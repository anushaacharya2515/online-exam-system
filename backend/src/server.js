import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import questionRoutes from "./routes/questions.js";
import examRoutes from "./routes/exams.js";
import studentRouter from "./routes/student.js";
import { db } from "./db.js";
import { ensureAdmin, ensureReferenceQuestionBank } from "./seed.js";
import { gradeAttempt } from "./services/grading.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/student", studentRouter(io));

function autoSubmitExpiredAttempts() {
  const data = db.read();
  let changed = false;

  for (let i = 0; i < data.attempts.length; i += 1) {
    const attempt = data.attempts[i];
    if (attempt.status !== "in_progress") continue;

    if (new Date(attempt.endAt).getTime() <= Date.now()) {
      const exam = data.exams.find((e) => e.id === attempt.examId);
      const examQuestions = data.questions.filter((q) => exam?.questionIds?.includes(q.id));
      const graded = gradeAttempt(examQuestions, attempt.answers || {});

      data.attempts[i] = {
        ...attempt,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        score: graded.score,
        details: graded.details
      };
      changed = true;

      io.emit("result:submitted", {
        examId: attempt.examId,
        attemptId: attempt.id,
        studentId: attempt.studentId,
        score: graded.score,
        submittedAt: data.attempts[i].submittedAt,
        autoSubmitted: true
      });
    }
  }

  if (changed) db.write(data);
}

io.on("connection", (socket) => {
  socket.emit("server:connected", { message: "Realtime channel connected" });
});

const PORT = process.env.PORT || 5000;

ensureAdmin().then(() => {
  ensureReferenceQuestionBank();
  setInterval(autoSubmitExpiredAttempts, 5000);

  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log("Default admin: admin@exam.com / admin123");
  });
});
