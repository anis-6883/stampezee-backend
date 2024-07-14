import express from "express";
import multer from "multer";
import { orderStamp, uploadInvoice } from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/order-stamp", orderStamp);
router.put("/update-invoice/:orderStampId", upload.single("invoice"), uploadInvoice);

export default router;
