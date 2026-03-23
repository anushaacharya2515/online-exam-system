import express from "express";
import { auth } from "../middleware/auth.js";
import {
  listQuestions,
  searchQuestions,
  filterQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  uploadCsv
} from "../controllers/questionController.js";

const router = express.Router();

router.use(auth("admin"));

router.get("/", listQuestions);
router.get("/search", searchQuestions);
router.get("/filter", filterQuestions);
router.post("/", createQuestion);
router.post("/bulk-csv", uploadCsv);
router.put("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

export default router;
