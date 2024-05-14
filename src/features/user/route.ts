import express from "express";
import { retailerRegistration } from "./retailer/controller";
import { adminLogin, adminLogout, adminRegistration } from "./super-admin/controller";

const router = express.Router();

// Admin
router.post("/admin-register", adminRegistration);
router.post("/admin-login", adminLogin);
router.post("/admin-logout", adminLogout);

// Retailer
router.post("/retailer-register", retailerRegistration);

// router.get("/auth-check", authCheck);
// router.get("/profile", auth, userProfile);
// router.post("/register", userRegistration);
// router.get("/refresh-token", auth, refreshAccessToken);

export default router;
