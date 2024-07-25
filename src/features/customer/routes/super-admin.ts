import express from "express";
import { getAllCustomers } from "../controller";

const router = express.Router();

router.get("/all", getAllCustomers);

export default router;
