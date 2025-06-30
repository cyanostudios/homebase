import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/activities", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const activities = await storage.getActivities(limit);
    res.json(activities);
  } catch {
    res.status(500).json({ message: "Failed to fetch activities" });
  }
});

router.delete("/activities", async (_req: Request, res: Response) => {
  try {
    await storage.clearAllActivities();
    res.json({ message: "All activities cleared successfully" });
  } catch {
    res.status(500).json({ message: "Failed to clear activities" });
  }
});

export default router;
