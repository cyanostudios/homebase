import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/:key", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const setting = await storage.getSetting(key);
    if (!setting) return res.status(404).json({ message: "Setting not found" });
    res.json(setting);
  } catch {
    res.status(500).json({ message: "Failed to fetch setting" });
  }
});

router.post("/:key", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const { value, type = "string" } = req.body;
    if (!value) return res.status(400).json({ message: "Value is required" });
    const setting = await storage.setSetting(key, value, type);
    res.json(setting);
  } catch {
    res.status(500).json({ message: "Failed to save setting" });
  }
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const settings = await storage.getSettings();
    res.json(settings);
  } catch {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

export default router;
