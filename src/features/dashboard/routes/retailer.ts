import express from "express";
import multer from "multer";
import { fetchDashboardRetailer } from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.get("/dashboard", fetchDashboardRetailer);

export default router;
