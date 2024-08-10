import express from "express";
import { getSettings } from "./controller";

const router = express.Router();

router.get("/settings", getSettings);

export default router;
