import express from "express";
import { stampScanDetailsForSuperAdmin } from "../controller";

const router = express.Router();

router.get("/details", stampScanDetailsForSuperAdmin);

export default router;
