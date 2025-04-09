import express from "express";
import { createTestData, getAllCriticalPayments, resolveCriticalPayment } from "./controller";

const router = express.Router();

router.get("/all", getAllCriticalPayments);
router.post("/resolve", resolveCriticalPayment);
router.post("/create-test-data", createTestData);

export default router;
