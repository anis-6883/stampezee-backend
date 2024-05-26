import express from "express";
import multer from "multer";
import {
  confirmDeleteStampImage,
  createStampImage,
  getAllDeletedStampImages,
  getAllStampImages,
  getSingleStampImage,
  softDeleteStampImage,
  updateStampImage,
} from "../controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/", upload.single("image"), createStampImage);
router.get("/all", getAllStampImages);
router.get("/deleted", getAllDeletedStampImages);
router.get("/:id", getSingleStampImage);
router.put("/:id", upload.single("image"), updateStampImage);
router.delete("/:id", softDeleteStampImage);
router.delete("/confirm/:id", confirmDeleteStampImage);

export default router;
