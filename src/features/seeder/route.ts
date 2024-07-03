import express from "express";
import { createBranches, createRetailers, createStamps } from "./controller";

const router = express.Router();

router.get("/create-retailers", createRetailers);
router.get("/create-branches", createBranches);
router.get("/create-stamps", createStamps);

export default router;
