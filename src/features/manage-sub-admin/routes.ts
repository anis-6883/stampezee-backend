import express from "express";
import multer from "multer";
import {
  confirmDeleteSubAdmin,
  createSubAdmin,
  getAllDeletedSubAdmins,
  getAllSubAdmins,
  getSingleSubAdmin,
  softDeleteSubAdmin,
  updateSubAdmin,
} from "./controller";
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.post("/create", upload.single("image"), createSubAdmin);
router.get("/all", getAllSubAdmins);
router.get("/deleted", getAllDeletedSubAdmins);
router.get("/:id", getSingleSubAdmin);
router.put("/:id", upload.single("image"), updateSubAdmin);
router.delete("/:id", softDeleteSubAdmin);
router.delete("/confirm/:id", confirmDeleteSubAdmin);

export default router;
