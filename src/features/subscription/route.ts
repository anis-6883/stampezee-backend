import express from "express";
import multer from "multer";
import {
  confirmDeleteSubscription,
  createSubscription,
  getAllDeletedSubscription,
  getAllSubscriptions,
  getSingleSubscription,
  softDeleteSubscription,
  updateSubscription,
  updateSubscriptionStatus,
} from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/", upload.single("image"), createSubscription);
router.get("/all", getAllSubscriptions);
router.get("/deleted", getAllDeletedSubscription);
router.put("/status/:id", updateSubscriptionStatus);
router.get("/:id", getSingleSubscription);
router.put("/:id", upload.single("image"), updateSubscription);
router.delete("/:id", softDeleteSubscription);
router.delete("/confirm/:id", confirmDeleteSubscription);

export default router;
