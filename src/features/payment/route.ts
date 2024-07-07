import express from "express";
import { getAllPayments } from "./controller";

const router = express.Router();

router.get("/", getAllPayments);

export default router;
