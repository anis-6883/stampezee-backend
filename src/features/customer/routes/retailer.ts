import express from "express";
import { getAllRetailerCustomers } from "../controller";

const router = express.Router();

router.get("/all", getAllRetailerCustomers);

export default router;
