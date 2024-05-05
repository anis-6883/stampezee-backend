import express from "express";
import auth from "../../middlewares/authMiddleware";
import {
  adminRegistration,
  refreshAccessToken,
  userLogin,
  userLogout,
  userProfile,
  userRegistration,
} from "./controller";

const router = express.Router();

router.post("/login", userLogin);
router.post("/register", userRegistration);
router.post("/admin-register", adminRegistration);
router.post("/logout", userLogout);
router.get("/profile", auth, userProfile);
router.get("/refresh-token", auth, refreshAccessToken);

export default router;
