import express from "express";
import { getAllRefundsForSuperAdmin, refundConfirmBySuperAdmin, refundDetailsForSuperAdmin } from "../controller";

const router = express.Router();

router.get("/all", getAllRefundsForSuperAdmin);
router.get("/find/:id", refundDetailsForSuperAdmin);
router.put("/confirm/:id", refundConfirmBySuperAdmin);

export default router;
