import express from "express";
import { createNotification, getAllNotificationsForRetailer } from "../controller";

const router = express.Router();

router.post("/", createNotification);
router.get("/all", getAllNotificationsForRetailer);

export default router;
