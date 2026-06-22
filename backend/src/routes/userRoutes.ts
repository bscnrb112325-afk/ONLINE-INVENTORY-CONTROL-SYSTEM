import { Router } from "express";
import { syncUser, getUsers, updateUser } from "../controllers/userController";
import { requireAuth } from "@clerk/express";

const router = Router();

// /api/users/sync - POST => sync the clerk user to DB (PROTECTED)
router.post("/sync", requireAuth, syncUser);

// User Management Routes
router.get("/", requireAuth, getUsers);
router.patch("/:id", requireAuth, updateUser);

export default router;
