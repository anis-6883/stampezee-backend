import express from "express";
import { collectedStampById, deleteCollectedStamp, getCollectedStamps } from "./controller";

const router = express.Router();

router.get("/collected-stamps", getCollectedStamps);
router.get("/collected-stamps/:id", collectedStampById);
router.delete("/collected-stamps/delete/:id", deleteCollectedStamp);

export default router;
