import express from "express";
import { collectedStampById, getCollectedStamps } from "./controller";

const router = express.Router();

router.get("/collected-stamps", getCollectedStamps);
router.get("/collected-stamps/:id", collectedStampById);

export default router;
