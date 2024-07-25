import express from "express";
import { getAllNotificationsForSuperAdmin } from "../controller";

const router = express.Router();

router.get("/all", getAllNotificationsForSuperAdmin);

export default router;
