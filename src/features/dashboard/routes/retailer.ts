import express from "express";
import { fetchDashboardRetailer } from "../controller";

const router = express.Router();

router.get("/calc", fetchDashboardRetailer);

export default router;
