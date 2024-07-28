import express from "express";
import { fetchDashboardRetailer } from "../controller";

const router = express.Router();

router.get("/dashboard", fetchDashboardRetailer);

export default router;
