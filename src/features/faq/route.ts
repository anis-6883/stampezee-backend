import express from "express";
import {
  confirmDeleteFaq,
  createFaq,
  getAllDeletedFaqs,
  getAllFaqs,
  getSingleFaq,
  softDeleteFaq,
  updateFaq,
  updateFaqStatus,
} from "./controller";

const router = express.Router();

router.post("/", createFaq);
router.get("/all", getAllFaqs);
router.get("/deleted", getAllDeletedFaqs);
router.put("/status/:id", updateFaqStatus);
router.get("/:id", getSingleFaq);
router.put("/:id", updateFaq);
router.delete("/:id", softDeleteFaq);
router.delete("/confirm/:id", confirmDeleteFaq);

export default router;
