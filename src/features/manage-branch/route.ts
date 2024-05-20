import express from "express";
import {
  confirmDeleteBranch,
  createBranch,
  getAllBranches,
  getAllDeletedBranches,
  getSingleBranch,
  softDeleteBranch,
  updateBranch,
} from "./controller";

const router = express.Router();

router.post("/create", createBranch);
router.get("/all", getAllBranches);
router.get("/deleted", getAllDeletedBranches);
router.get("/:id", getSingleBranch);
router.put("/:id", updateBranch);
router.delete("/:id", softDeleteBranch);
router.delete("/confirm/:id", confirmDeleteBranch);

export default router;
