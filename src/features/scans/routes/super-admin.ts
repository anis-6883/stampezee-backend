import express from "express";
import multer from "multer";
import { stampScanDetailsForSuperAdmin } from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.get("/details", stampScanDetailsForSuperAdmin);

export default router;
