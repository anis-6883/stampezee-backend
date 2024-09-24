import express from "express";
import {
  createCustomerBySuperAdmin,
  getAllCustomers,
  getSingleCustomer,
  getSingleCustomerScanList,
  softDeleteCustomerBySuperAdmin,
  updateCustomerBySuperAdmin,
  updateCustomerStatusBySuperAdmin,
} from "../controller";

const router = express.Router();

router.get("/all", getAllCustomers);
router.get("/find/:id", getSingleCustomer);
router.get("/scans/:id", getSingleCustomerScanList);
router.post("/create", createCustomerBySuperAdmin);
router.put("/status/:id", updateCustomerStatusBySuperAdmin);
router.put("/:id", updateCustomerBySuperAdmin);
router.delete("/:id", softDeleteCustomerBySuperAdmin);

export default router;
