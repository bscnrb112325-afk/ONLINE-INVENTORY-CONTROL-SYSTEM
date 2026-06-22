import { Request, Response } from "express";
import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settingsRow = await db.query.settings.findFirst({
      where: eq(settings.id, "default"),
    });

    if (!settingsRow) {
      // Create default settings row if it doesn't exist
      const newSettings = await db
        .insert(settings)
        .values({ id: "default" })
        .returning();
      settingsRow = newSettings[0];
    }

    res.status(200).json(settingsRow);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyName, logoUrl, currency, taxRate, theme, font } = req.body;

    // Check if the default row exists
    const settingsRow = await db.query.settings.findFirst({
      where: eq(settings.id, "default"),
    });

    if (!settingsRow) {
      await db.insert(settings).values({
        id: "default",
        companyName,
        logoUrl,
        currency,
        taxRate,
        theme,
        font,
      });
    } else {
      await db
        .update(settings)
        .set({
          companyName,
          logoUrl,
          currency,
          taxRate,
          theme,
          font,
        })
        .where(eq(settings.id, "default"));
    }

    const updatedSettings = await db.query.settings.findFirst({
      where: eq(settings.id, "default"),
    });

    res.status(200).json(updatedSettings);
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
