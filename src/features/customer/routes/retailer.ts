import express from "express";
import { getAllRetailerCustomers, getSingleCustomer, getSingleCustomerScanList } from "../controller";

const router = express.Router();

router.get("/all", getAllRetailerCustomers);
router.get("/find/:id", getSingleCustomer);
router.get("/scans/:id", getSingleCustomerScanList);

export default router;
