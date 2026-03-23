import express from "express";
import { auth } from "../middleware/auth.js";
import {
  createExam,
  listExams,
  getExam,
  generateExam,
  submitExam
} from "../controllers/examController.js";

const router = express.Router();

router.use(auth());

router.post("/", createExam);
router.get("/", listExams);
router.get("/:id", getExam);
router.post("/generate", generateExam);
router.post("/submit", submitExam);

export default router;
