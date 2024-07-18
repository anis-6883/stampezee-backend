import express from "express";
import { getAllRefundsForSuperAdmin } from "../controller";

const router = express.Router();

router.get("/all", getAllRefundsForSuperAdmin);

export default router;
