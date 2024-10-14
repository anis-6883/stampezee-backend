import express from "express";
import { getAllNotificationsForSuperAdmin, sendNotificationBySuperAdmin } from "../controller";

const router = express.Router();

router.post("/send", sendNotificationBySuperAdmin);
router.get("/all", getAllNotificationsForSuperAdmin);

export default router;
