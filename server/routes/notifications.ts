import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

const router = Router();

router.post("/:id/read", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await storage.markNotificationAsRead(id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json(notification);
  } catch {
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

export default router;
