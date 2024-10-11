import express from "express";
import { getAllCriticalPayments, resolveCriticalPayment } from "./controller";

const router = express.Router();

router.get("/all", getAllCriticalPayments);
router.post("/resolve", resolveCriticalPayment);

export default router;
