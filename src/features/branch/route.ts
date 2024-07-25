import express from "express";
import {
  activateSystemDisabledBranch,
  branchRenew,
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
router.put("/renew/:id", branchRenew);
router.put("/activate/:id", activateSystemDisabledBranch);
router.put("/status/:id", updateBranchStatus);
router.delete("/confirm/:id", confirmDeleteBranch);
router.get("/:id", getSingleBranch);
router.put("/:id", updateBranch);
router.delete("/:id", softDeleteBranch);

export default router;
