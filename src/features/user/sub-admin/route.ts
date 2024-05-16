import express from "express";

import { subAdminLogin } from "./controller";

const router = express.Router();

router.post("/login", subAdminLogin);

export default router;
