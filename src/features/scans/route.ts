import express from "express";
import multer from "multer";
import { stampScanDetails } from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.get("/details", stampScanDetails);

export default router;
