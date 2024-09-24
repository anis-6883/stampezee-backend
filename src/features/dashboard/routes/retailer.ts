import express from "express";
import { retailerDashboard } from "../controller";

const router = express.Router();

router.get("/calc", retailerDashboard);

export default router;
