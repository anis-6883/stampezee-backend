import express from "express";
import multer from "multer";
import { orderStamp } from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/order-stamp", upload.single("invoice"), orderStamp);

export default router;
