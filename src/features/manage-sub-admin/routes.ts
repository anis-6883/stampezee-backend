import express from "express";
import { createSubAdmin, deleteSubAdmin, getAllSubAdmins, getSingleSubAdmin, updateSubAdmin } from "./controller";

const router = express.Router();

router.post("/create", createSubAdmin);
router.get("/all", getAllSubAdmins);
router.get("/:id", getSingleSubAdmin);
router.put("/:id", updateSubAdmin);
router.delete("/:id", deleteSubAdmin);

export default router;
