import express from "express";
import { getCollectedStamps } from "./controller";

const router = express.Router();

router.get("/collected-stamps", getCollectedStamps);

export default router;
