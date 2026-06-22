import type { Request, Response } from "express";
import * as queries from "../db/queries";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

import { getAuth } from "@clerk/express";

export async function syncUser(req: Request, res: Response) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { email, name, imageUrl } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    const user = await queries.upsertUser({
      id: userId,
      email,
      name,
      avatarDriveId: imageUrl,
      role: "admin", // set to admin so user can test settings
    });

    res.status(200).json(user);
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const allUsers = await db.query.users.findMany();
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [updatedUser] = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id as string))
      .returning();
      
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
}

