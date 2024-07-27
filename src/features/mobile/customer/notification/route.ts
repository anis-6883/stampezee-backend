import express from "express";
import { getAllNotificationsForCustomer } from "./controller";

const router = express.Router();

router.get("/list", getAllNotificationsForCustomer);

export default router;
