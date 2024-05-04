import express from "express";
import auth from "../../middlewares/authMiddleware";
import { adminLogin, adminLogout, adminProfile, adminRegistration, refreshAccessToken } from "./controller";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register", adminRegistration);
router.post("/logout", adminLogout);
router.get("/profile", auth, adminProfile);
router.get("/refresh-token", auth, refreshAccessToken);

export default router;
