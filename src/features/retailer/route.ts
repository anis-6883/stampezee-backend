import express from "express";
import multer from "multer";
import {
  confirmDeleteRetailer,
  createRetailer,
  getAllDeletedRetailers,
  getAllRetailers,
  getSingleRetailer,
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
router.put("/status/:id", updateRetailerStatus);
router.get("/:id", getSingleRetailer);
router.put("/:id", upload.single("image"), updateRetailer);
router.delete("/:id", softDeleteRetailer);
router.delete("/confirm/:id", confirmDeleteRetailer);

export default router;
