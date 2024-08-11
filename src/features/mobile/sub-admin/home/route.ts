import express from "express";
import multer from "multer";
import { orderDetails, orderStamp, recentScans, scanHistory, uploadInvoice } from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/order-stamp", orderStamp);
router.put("/update-invoice/:orderStampId", upload.single("invoice"), uploadInvoice);
router.get("/scan-history", scanHistory);
router.get("/recent-scans", recentScans);
router.get("/order-details/:id", orderDetails);

export default router;
