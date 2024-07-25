import express from "express";
import { getAllRefundsForSuperAdmin, refundConfirmBySuperAdmin } from "../controller";

const router = express.Router();

router.get("/all", getAllRefundsForSuperAdmin);
router.put("/confirm/:id", refundConfirmBySuperAdmin);

export default router;
