import express from "express";
import { subscribedUserList } from "./controller";

const router = express.Router();

router.get("/subscribers", subscribedUserList);

export default router;
