import express from "express";
import { getSubscriptionPayments } from "./controller";

const router = express.Router();

router.get("/subscription", getSubscriptionPayments);

export default router;
