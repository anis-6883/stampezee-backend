import express from "express";
import multer from "multer";
import {
  confirmDeleteSubAdmin,
  createSubAdmin,
  getAllDeletedSubAdmins,
  getAllSubAdmins,
  getBranches,
  getSingleSubAdmin,
  softDeleteSubAdmin,
  updateSubAdmin,
  updateSubAdminStatus,
} from "./controller";
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.post("/", upload.single("image"), createSubAdmin);
router.get("/all", getAllSubAdmins);
router.get("/branches", getBranches);
router.get("/deleted", getAllDeletedSubAdmins);
router.put("/status/:id", updateSubAdminStatus);
router.get("/:id", getSingleSubAdmin);
router.put("/:id", upload.single("image"), updateSubAdmin);
router.delete("/:id", softDeleteSubAdmin);
router.delete("/confirm/:id", confirmDeleteSubAdmin);

export default router;
