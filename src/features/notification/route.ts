import express from "express";
import { createNotification } from "./controller";

const router = express.Router();

router.post("/", createNotification);

export default router;
