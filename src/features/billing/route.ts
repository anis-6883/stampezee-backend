import express from "express";
import { getAllBillings, getSingleBilling } from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.get("/find/:id", getSingleBilling);

export default router;
