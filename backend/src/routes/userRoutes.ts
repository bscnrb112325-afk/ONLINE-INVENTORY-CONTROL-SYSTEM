import { Router } from "express";
import { syncUser, getUsers, updateUser, createUser, resetPassword, verifyPosUnlock, updatePosPassword } from "../controllers/userController";
import { requireAuth } from "@clerk/express";

const router = Router();

// /api/users/sync - POST => sync the clerk user to DB (PROTECTED)
router.post("/sync", requireAuth, syncUser);

// User Management Routes
router.get("/", requireAuth, getUsers);
router.post("/", requireAuth, createUser);
router.post("/verify-pos", requireAuth, verifyPosUnlock);
router.post("/update-pos-password", requireAuth, updatePosPassword);
router.post("/:id/reset-password", requireAuth, resetPassword);
router.patch("/:id", requireAuth, updateUser);

export default router;
