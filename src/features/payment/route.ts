import express from "express";
import { getSingleSubscriptionPayment, getSubscriptionPayments } from "./controller";

const router = express.Router();

router.get("/subscription/all", getSubscriptionPayments);
router.get("/subscription/find/:id", getSingleSubscriptionPayment);

export default router;
