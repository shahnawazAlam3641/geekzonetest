import { Request } from "express";
import { Server as SocketServer } from "socket.io";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      io?: SocketServer;
    }
  }
}
