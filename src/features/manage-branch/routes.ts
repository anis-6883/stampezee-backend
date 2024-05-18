import express from "express";
import { createBranch, deleteBranch, getAllBranches, getSingleBranch, updateBranch } from "./controller";

const router = express.Router();

router.post("/create", createBranch);
router.get("/all", getAllBranches);
router.get("/:id", getSingleBranch);
router.put("/:id", updateBranch);
router.delete("/:id", deleteBranch);

export default router;
