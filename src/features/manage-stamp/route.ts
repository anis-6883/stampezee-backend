import express from "express";
import {
  confirmDeleteStamp,
  createStamp,
  getAllDeletedStamps,
  getAllStamps,
  getSingleStamp,
  softDeleteStamp,
  updateStamp,
} from "./controller";

const router = express.Router();

router.post("/", createStamp);
router.get("/all", getAllStamps);
router.get("/deleted", getAllDeletedStamps);
router.get("/:id", getSingleStamp);
router.put("/:id", updateStamp);
router.delete("/:id", softDeleteStamp);
router.delete("/confirm/:id", confirmDeleteStamp);

export default router;
