import express from "express";
import multer from "multer";
import {
  getAllNotificationsForSuperAdmin,
  notificationDeleteBySuperAdmin,
  sendNotificationBySuperAdmin,
} from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.get("/all", getAllNotificationsForSuperAdmin);
router.post("/send", upload.single("image"), sendNotificationBySuperAdmin);
router.delete("/delete/:id", notificationDeleteBySuperAdmin);

export default router;
