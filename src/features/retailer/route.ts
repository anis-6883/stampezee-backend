import express from "express";
import multer from "multer";
import {
  confirmDeleteRetailer,
  createRetailer,
  getAllDeletedRetailers,
  getAllRetailers,
  getSingleRetailer,
  retailerPayments,
  softDeleteRetailer,
  updateRetailer,
  updateRetailerStatus,
} from "./controller";
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.post("/", upload.single("image"), createRetailer);
router.get("/all", getAllRetailers);
router.get("/deleted", getAllDeletedRetailers);
router.get("/payments/:id", retailerPayments);
router.put("/status/:id", updateRetailerStatus);
router.delete("/confirm/:id", confirmDeleteRetailer);
router.get("/:id", getSingleRetailer);
router.put("/:id", upload.single("image"), updateRetailer);
router.delete("/:id", softDeleteRetailer);

export default router;
