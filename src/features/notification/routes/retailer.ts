import express from "express";
import multer from "multer";
import { createNotification, createNotificationBasedOnLocation, getAllNotificationsForRetailer } from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/all", upload.single("image"), createNotification);
router.post("/location", upload.single("image"), createNotificationBasedOnLocation);
router.get("/all", getAllNotificationsForRetailer);

export default router;
