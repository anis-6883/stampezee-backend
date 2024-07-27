import express from "express";
import { createNotification, createNotificationBasedOnLocation, getAllNotificationsForRetailer } from "../controller";

const router = express.Router();

router.post("/all", createNotification);
router.post("/location", createNotificationBasedOnLocation);
router.get("/all", getAllNotificationsForRetailer);

export default router;
