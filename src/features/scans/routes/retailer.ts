import express from "express";
import multer from "multer";
import { stampScanDetailsForRetailer } from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.get("/details", stampScanDetailsForRetailer);

export default router;
