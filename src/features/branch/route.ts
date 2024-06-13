import express from "express";
import {
  confirmDeleteBranch,
  createBranch,
  getAllBranches,
  getAllDeletedBranches,
  getSingleBranch,
  softDeleteBranch,
  updateBranch,
  updateBranchStatus,
} from "./controller";

const router = express.Router();

router.post("/", createBranch);
router.get("/all", getAllBranches);
router.get("/deleted", getAllDeletedBranches);
router.put("/status/:id", updateBranchStatus);
router.delete("/confirm/:id", confirmDeleteBranch);
router.get("/:id", getSingleBranch);
router.put("/:id", updateBranch);
router.delete("/:id", softDeleteBranch);

export default router;
