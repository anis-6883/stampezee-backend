import express from "express";
import { stampScanDetailsForRetailer } from "../controller";

const router = express.Router();

router.get("/details", stampScanDetailsForRetailer);

export default router;
