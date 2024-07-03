import express from "express";
import multer from "multer";
import {
  confirmDeleteCategory,
  createCategory,
  getAllCategories,
  getAllDeletedCategories,
  getSingleCategory,
  softDeleteCategory,
  updateCategory,
  updateCategoryStatus,
} from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/", upload.single("image"), createCategory);
router.get("/all", getAllCategories);
router.get("/deleted", getAllDeletedCategories);
router.put("/status/:id", updateCategoryStatus);
router.delete("/confirm/:id", confirmDeleteCategory);
router.get("/:id", getSingleCategory);
router.put("/:id", upload.single("image"), updateCategory);
router.delete("/:id", softDeleteCategory);

export default router;
