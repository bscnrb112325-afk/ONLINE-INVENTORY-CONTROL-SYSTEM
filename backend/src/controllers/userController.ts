import type { Request, Response } from "express";
import * as queries from "../db/queries";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

import { getAuth } from "@clerk/express";

export async function syncUser(req: Request, res: Response) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { email, name, imageUrl } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    const existingUser = await queries.getUserById(userId);
    let user;
    
    if (existingUser) {
      const [updated] = await db.update(schema.users)
        .set({ name, email, avatarDriveId: imageUrl })
        .where(eq(schema.users.id, userId))
        .returning();
      user = updated;
    } else {
      const [inserted] = await db.insert(schema.users)
        .values({
          id: userId,
          email,
          name,
          avatarDriveId: imageUrl,
          role: "admin",
          module: "dashboard",
        })
        .returning();
      user = inserted;
    }

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

export async function createUser(req: Request, res: Response) {
  try {
    let { email, password, name, role, module } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    email = email.trim();
    name = name.trim();

    // 1. Create user in Clerk
    // Clerk might require a username depending on instance settings
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') + Math.floor(Math.random() * 10000);
    
    const clerkRes = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`
      },
      body: JSON.stringify({
        email_address: [email],
        username,
        password,
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' ') || undefined,
        skip_password_checks: true,
        skip_password_requirement: true
      })
    });

    if (!clerkRes.ok) {
      const errorData = await clerkRes.json();
      console.error("Clerk Error:", errorData);
      return res.status(400).json({ error: "Failed to create user in Clerk auth provider.", details: errorData });
    }

    const clerkUser = await clerkRes.json();
    const newUserId = clerkUser.id;

    // 2. Add user to local DB
    // Hash password for POS lock screen
    const posPasswordHash = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = await queries.upsertUser({
      id: newUserId,
      email,
      name,
      avatarDriveId: clerkUser.image_url || null,
      role: role || "user",
      module: module || "dashboard",
      posPassword: posPasswordHash
    });

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user", details: error.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`
      },
      body: JSON.stringify({ password: newPassword, skip_password_checks: true })
    });

    if (!clerkRes.ok) {
      const err = await clerkRes.json();
      console.error("Clerk Reset Password Error:", err);
      return res.status(400).json({ error: "Failed to reset password in Clerk", details: err });
    }

    res.json({ message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Failed to reset password", details: error.message });
  }
}

export async function verifyPosUnlock(req: Request, res: Response) {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ error: "Name and password are required" });
    }

    const inputHash = crypto.createHash('sha256').update(password).digest('hex');

    // Find user by name AND password (case insensitive for name)
    const allUsers = await db.query.users.findMany();
    const user = allUsers.find((u: any) => 
      u.name?.trim().toLowerCase() === name.trim().toLowerCase() &&
      (u.posPassword === inputHash || u.password === inputHash)
    );

    if (user) {
      return res.json({ success: true, user });
    } else {
      return res.status(401).json({ error: "Incorrect cashier name or password" });
    }
  } catch (error: any) {
    console.error("Verify POS Unlock Error:", error);
    res.status(500).json({ error: "Failed to verify POS unlock", details: error.message });
  }
}

export async function updatePosPassword(req: Request, res: Response) {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await queries.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentHash = crypto.createHash('sha256').update(currentPassword).digest('hex');
    
    if (user.posPassword !== currentHash && user.password !== currentHash) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    await db.update(schema.users)
      .set({ posPassword: newHash })
      .where(eq(schema.users.id, userId));

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Update POS Password Error:", error);
    res.status(500).json({ error: "Failed to update password", details: error.message });
  }
}

