import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RequestWithUserId } from "../types";

export const auth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
