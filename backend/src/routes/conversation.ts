import express, { Request, Response } from "express";
import { auth } from "../middleware/auth";
import Conversation from "../models/Conversation";
import Message from "../models/Message";

const router = express.Router();

router.post(
  "/create-conversation",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { participantId } = req.body;

      const existingConversation = await Conversation.findOne({
        participants: { $all: [req.userId, participantId], $size: 2 },
        isGroup: false,
      });

      if (existingConversation) {
        res.json(existingConversation);
        return;
      }

      const conversation = new Conversation({
        participants: [req.userId, participantId],
        isGroup: false,
      });

      await conversation.save();
      await conversation.populate("participants", "username profilePicture");

      res.status(201).json(conversation);
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error creating conversation" });
    }
  }
);

router.get(
  "/get-all",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const conversations = await Conversation.find({
        participants: req.userId,
      })
        .populate("participants", "username profilePicture")
        .populate("lastMessage")
        .sort({ updatedAt: -1 });

      res.json(conversations);
      return;
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error fetching conversations" });
    }
  }
);

router.post(
  "/create-group",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, participants } = req.body;

      if (!participants.includes(req.userId)) {
        participants.push(req.userId);
      }

      const conversation = new Conversation({
        participants,
        isGroup: true,
        groupName: name,
        groupAdmin: req.userId,
      });

      await conversation.save();
      await conversation.populate("participants", "username profilePicture");

      res.status(201).json(conversation);
      return;
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error creating group conversation" });
    }
  }
);

router.get(
  "/get/:friendId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const conversation = await Conversation.findOne({
        participants: { $all: [req.userId, req.params.friendId] },
      })
        .populate("participants")
        .populate({
          path: "messages",
        });

      if (!conversation) {
        res.status(404).json({ message: "Conversation not found" });
        return;
      }
      res.json(conversation);
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error fetching conversation" });
    }
  }
);

export default router;
