import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./config/database";

import authRoutes from "./routes/auth";
import postRoutes from "./routes/post";
import userRoutes from "./routes/user";
import conversationRoutes from "./routes/conversation";
import messageRoutes from "./routes/message";
import notificationRoutes from "./routes/notification";
import aiRoutes from "./routes/ai";

import { createServer } from "http";
import { Server } from "socket.io";
import Conversation from "./models/Conversation";
import Message from "./models/Message";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use((req: Request, res, next) => {
  req.io = io;
  next();
});

const PORT = process.env.PORT || 3001;

app.get("/api/v1/check", (req, res) => {
  console.log("Backend is alive");
  res.send("Backend is alive");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/conversation", conversationRoutes);
app.use("/api/v1/message", messageRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/ai", aiRoutes);

const onlineUsers = new Map<string, string>();

io.on("connection", (socket) => {
  const userId = socket.handshake.auth.userId;
  if (userId) {
    socket.join(userId);
  }

  socket.on("user-online", (userId: string) => {
    onlineUsers.set(userId, socket.id);
    socket.join(userId);

    // Notify all clients who is online
    io.emit("update-online-users", [...onlineUsers.keys()]);
  });

  socket.on("join-room", ({ conversationId }: { conversationId: string }) => {
    socket.join(conversationId);
  });

  socket.on("leave-room", ({ conversationId }: { conversationId: string }) => {
    socket.leave(conversationId);
  });

  socket.on("send-message", async ({ conversationId, message }) => {
    try {
      let conversation = await Conversation.findOne({
        participants: { $all: conversationId.split("_") },
      });

      if (!conversation) {
        conversation = new Conversation({
          participants: conversationId.split("_"),
          messages: [],
        });
      }

      const newMessage = await Message.create({
        conversation: conversation._id,
        sender: message.sender,
        content: message.content,
      });

      conversation.messages?.push(newMessage._id);

      await conversation.save();

      io.to(conversationId).emit("receive-message", message);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on(
    "typing",
    ({
      conversationId,
      username,
    }: {
      conversationId: string;
      username: string;
    }) => {
      socket.to(conversationId).emit("user-typing", { username });
    }
  );

  socket.on(
    "stop-typing",
    ({
      conversationId,
      username,
    }: {
      conversationId: string;
      username: string;
    }) => {
      socket.to(conversationId).emit("user-stop-typing", { username });
    }
  );

  socket.on("disconnect", () => {
    for (let [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit("update-online-users", [...onlineUsers.keys()]);
  });
});

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
  });
});
