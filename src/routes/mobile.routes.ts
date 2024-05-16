import express from "express";
import customerAuthRoutes from "../features/user/customer/route";

const router = express.Router();

router.use("/customer", customerAuthRoutes);

export default router;
