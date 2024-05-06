import express from "express";
import auth from "../../middlewares/authMiddleware";
import {
  adminRegistration,
  authCheck,
  refreshAccessToken,
  retailerRegistration,
  userLogin,
  userLogout,
  userProfile,
  userRegistration,
} from "./controller";

const router = express.Router();

router.post("/login", userLogin);
router.post("/logout", userLogout);
router.get("/auth-check", authCheck);
router.get("/profile", auth, userProfile);
router.post("/register", userRegistration);
router.post("/admin-register", adminRegistration);
router.post("/retailer-register", retailerRegistration);
router.get("/refresh-token", auth, refreshAccessToken);

export default router;
