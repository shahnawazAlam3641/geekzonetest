import express, { Request, Response } from "express";
import { auth } from "../middleware/auth";
import Conversation from "../models/Conversation";
import Message from "../models/Message";

const router = express.Router();

router.post("/", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, content } = req.body;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId,
    });

    if (!conversation) {
      res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
      return;
    }

    const message = new Message({
      conversation: conversationId,
      sender: req.userId,
      content,
    });

    await message.save();
    await message.populate("sender", "username profilePicture");

    conversation.lastMessage = message._id;
    await conversation.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: "Error sending message" });
  }
});

router.post(
  "/:conversationId/read",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;

      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: req.userId },
          read: false,
        },
        { read: true }
      );

      res.json({ message: "Messages marked as read" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error marking messages as read" });
      console.log(error);
    }
  }
);

export default router;
