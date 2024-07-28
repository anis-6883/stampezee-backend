import express from "express";
import { fetchDashboardSuperAdmin } from "../controller";

const router = express.Router();

router.get("/calc", fetchDashboardSuperAdmin);

export default router;
