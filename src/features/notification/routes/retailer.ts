import express from "express";
import multer from "multer";
import { getAllNotificationsForRetailer, sendNotification, sendNotificationBasedOnLocation } from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/all", upload.single("image"), sendNotification);
router.post("/location", upload.single("image"), sendNotificationBasedOnLocation);
router.get("/all", getAllNotificationsForRetailer);

export default router;
