import express, { Request, Response } from "express";
import { auth } from "../middleware/auth";
import Post from "../models/Post";
import mongoose from "mongoose";
import { uploadImg } from "../middleware/uploadImg";
import { uploadImage } from "../config/uploadImg";
import Notification from "../models/Notificaton";

const router = express.Router();

//create post
router.post(
  "/create",
  uploadImg.single("postPicture"),
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, image } = req.body;

      const post = new Post({
        author: req.userId,
        content,
        image,
      });

      if (req.file) {
        const imageUrl = await uploadImage(req.file.buffer, "postPicture");
        post.image = imageUrl;
      }

      await post.save();
      await post.populate("author", "username profilePicture");

      res.status(201).json({ success: true, message: "Post created", post });
      return;
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error creating post", error });
      console.log(error);
      return;
    }
  }
);

//get all post
router.get("/", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "username profilePicture")
      .populate("comments.user", "username profilePicture");

    const total = await Post.countDocuments();

    res.json({
      success: true,
      message: "Posts Fetched Successfully",
      posts,
      hasMore: total > skip + posts.length,
    });
    return;
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching posts" });
  }
});

//get single post
router.get(
  "/:postId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = req.params.postId;
      const post = await Post.findById(postId)

        .populate("author", "username profilePicture")
        .populate("comments.user", "username profilePicture");

      res.json({
        success: true,
        message: "Post Fetched Successfully",
        post,
      });
      return;
    } catch (error) {
      res.status(500).json({ success: false, message: "Error fetching posts" });
    }
  }
);

//like post
router.post(
  "/:id/like",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const post = await Post.findById(req.params.id)
        .populate("author", "username profilePicture")
        .populate("comments.user", "username profilePicture");
      if (!post) {
        res.status(404).json({ success: false, message: "Post not found" });
        return;
      }

      const likeIndex = post.likes.indexOf(
        new mongoose.Types.ObjectId(req.userId)
      );
      if (likeIndex === -1) {
        //like
        post.likes.push(new mongoose.Types.ObjectId(req.userId));

        //create notification
        const notification = await Notification.create({
          recipient: post.author._id,
          sender: req.userId,
          type: "like",
          post: post._id,
        });

        if (req.io) {
          req.io
            .to(post.author._id.toString())
            .emit("new-notification", notification);
        }
      } else {
        //unlike
        post.likes.splice(likeIndex, 1);
      }

      await post.save();

      res.json({
        success: true,
        message: "operation done sucessfully",
        post,
      });
      return;
    } catch (error) {
      res
        .status(500)
        .json({ success: "flase", message: "Error updating post" });
      console.log(error);
    }
  }
);

//comment post
router.post(
  "/:id/comments",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { content } = req.body;
      const post = await Post.findById(req.params.id).populate("author");

      if (!post) {
        res.status(404).json({ success: "false", message: "Post not found" });
        return;
      }
      const userId = new mongoose.Types.ObjectId(req.userId);

      post.comments.push({
        user: userId,
        content,
      });

      const notification = await Notification.create({
        recipient: post.author._id,
        sender: req.userId,
        type: "comment",
        post: post._id,
      });

      if (req.io) {
        req.io
          .to(post.author._id.toString())
          .emit("new-notification", notification);
      }

      await post.save();
      await post.populate("comments.user", "username profilePicture");

      res.json({ success: true, message: "Comment posted successfully", post });
    } catch (error) {
      res.status(500).json({ message: "Error adding comment" });
    }
  }
);

export default router;
