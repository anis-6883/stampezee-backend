import express from "express";
import multer from "multer";
import { fetchDashboardSuperAdmin } from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.get("/calc", fetchDashboardSuperAdmin);

export default router;
