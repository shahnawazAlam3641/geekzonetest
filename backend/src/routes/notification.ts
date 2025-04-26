import express, { Request, Response } from "express";
import { auth } from "../middleware/auth";
import Notification from "../models/Notificaton";

const router = express.Router();

// Get all notifications for a user
router.get("/", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipient: req.userId })
      .populate("sender", "username profilePicture")
      .populate("post", "content")
      .sort({ createdAt: -1 });

    res.json({ notifications });
    return;
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications." });
  }
});

// Mark a notification as read
router.put(
  "/:id/read",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const notification = await Notification.findById(req.params.id);

      if (!notification) {
        res.status(404).json({ message: "Notification not found." });
        return;
      }

      if (notification.recipient.toString() !== req.userId.toString()) {
        res.status(403).json({ message: "Not authorized." });
        return;
      }

      notification.isRead = true;
      await notification.save();

      res.json({ message: "Marked as read." });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark as read." });
    }
  }
);

//mark all notification as read
router.put(
  "/readAll",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const notification = await Notification.updateMany(
        {
          $and: [{ recipient: req.userId }, { isRead: false }],
        },
        { isRead: true }
      );

      res.json({ message: "Marked as read." });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark as read." });
    }
  }
);

export default router;
