import express, { Request, Response } from "express";
import { auth } from "../middleware/auth";
import User from "../models/User";
import mongoose from "mongoose";
import Post from "../models/Post";
import { uploadImg } from "../middleware/uploadImg";
import { uploadImage } from "../config/uploadImg";
import bcrypt from "bcrypt";
import Notification from "../models/Notificaton";

const router = express.Router();

//search user
router.get(
  "/search",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, page = 1, limit = 10 } = req.query;

      if (!query) {
        res.json({ users: [] });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const users = await User.find({
        $and: [
          { _id: { $ne: req.userId } },
          {
            $or: [
              { username: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          },
        ],
      })
        .select("username email profilePicture isVerified")
        .select("username email profilePicture isVerified")
        .skip(skip)
        .limit(Number(limit));

      res.json({ users });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error searching users" });
      console.log(error);
    }
  }
);

//get all users
router.get("/all", auth, async (req: Request, res: Response) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "username email profilePicture isVerified"
    );

    res.status(200).json(users);
  } catch (error) {
    console.log(error);
  }
});

//send friend request
router.post(
  "/friends/request/:userId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const friendUser = await User.findById(userId).select("-password");
      const currentUser = await User.findById(req.userId).select("-password");

      if (!friendUser || !currentUser) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      if (
        friendUser.recievedFriendRequests.includes(
          new mongoose.Types.ObjectId(req.userId)
        ) ||
        friendUser.sentFriendRequests.includes(
          new mongoose.Types.ObjectId(req.userId)
        ) ||
        currentUser.recievedFriendRequests.includes(
          new mongoose.Types.ObjectId(userId)
        ) ||
        currentUser.sentFriendRequests.includes(
          new mongoose.Types.ObjectId(userId)
        )
      ) {
        res
          .status(400)
          .json({ success: false, message: "Friend request already exists" });
        return;
      }

      if (
        friendUser.friends.includes(new mongoose.Types.ObjectId(req.userId))
      ) {
        res.status(400).json({ success: false, message: "Already friends" });
        return;
      }

      await Notification.create({
        recipient: friendUser._id,
        sender: req.userId,
        type: "friend_request",
      });

      friendUser.recievedFriendRequests.push(
        new mongoose.Types.ObjectId(req.userId)
      );
      currentUser.sentFriendRequests.push(new mongoose.Types.ObjectId(userId));

      await friendUser.save();
      await currentUser.save();

      // Find all posts related to the user
      const allPosts = await Post.find({
        $or: [{ author: userId }, { likes: userId }],
      })
        .select("content image likes comments createdAt author")
        .populate("author", "username profilePicture")
        .populate("likes", "username profilePicture")
        .populate("comments.user", "username profilePicture");

      // Filter posts by author
      const userPosts = allPosts.filter(
        (post) => post.author._id.toString() === userId
      );

      // Filter posts by likes
      const likedPosts = allPosts.filter((post) => {
        if (!post.likes) return false;
        return post.likes.some((like) => like._id.toString() === userId);
      });

      // Filter saved posts
      const savedPosts = allPosts.filter((post) => {
        if (!post.savedBy) return false;
        return post.savedBy.some((saved) => saved._id.toString() === userId);
      });

      // Convert user to plain object
      // const userObject = user.toObject();

      res.json({
        message: "Friend request sent",
        otherUser: {
          ...friendUser.toObject(),
          posts: userPosts,
          likedPosts,
          savedPosts,
        },
        currentUser: currentUser,
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error sending friend request" });
      console.log(error);
    }
  }
);

//accept friend request
router.post(
  "/friends/accept/:userId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const currentUser = await User.findById(req.userId).select("-password");
      const friendUser = await User.findById(userId).select("-password");

      if (!currentUser || !friendUser) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      if (
        !currentUser.recievedFriendRequests.includes(
          new mongoose.Types.ObjectId(userId)
        )
      ) {
        res
          .status(400)
          .json({ success: false, message: "No friend request found" });
        return;
      }

      currentUser.recievedFriendRequests =
        currentUser.recievedFriendRequests.filter(
          (id) => id.toString() !== userId
        );

      friendUser.sentFriendRequests = currentUser.sentFriendRequests.filter(
        (id) => id.toString() !== req?.userId
      );

      currentUser.friends.push(new mongoose.Types.ObjectId(userId));
      friendUser.friends.push(new mongoose.Types.ObjectId(req.userId));

      await currentUser.save();
      await friendUser.save();

      // Find all posts related to the user
      const allPosts = await Post.find({
        $or: [{ author: userId }, { likes: userId }],
      })
        .select("content image likes comments createdAt author")
        .populate("author", "username profilePicture")
        .populate("likes", "username profilePicture")
        .populate("comments.user", "username profilePicture");

      // Filter posts by author
      const userPosts = allPosts.filter(
        (post) => post.author._id.toString() === userId
      );

      // Filter posts by likes
      const likedPosts = allPosts.filter((post) => {
        if (!post.likes) return false;
        return post.likes.some((like) => like._id.toString() === userId);
      });

      // Filter saved posts
      const savedPosts = allPosts.filter((post) => {
        if (!post.savedBy) return false;
        return post.savedBy.some((saved) => saved._id.toString() === userId);
      });

      res.json({
        message: "Friend request sent",
        otherUser: {
          ...friendUser.toObject(),
          posts: userPosts,
          likedPosts,
          savedPosts,
        },
        currentUser: currentUser,
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error accepting friend request" });
    }
  }
);

//reject friend request
router.post(
  "/friends/reject/:userId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const currentUser = await User.findById(req.userId).select("-password");
      const friendUser = await User.findById(userId).select("-password");

      if (!currentUser || !friendUser) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      if (
        !currentUser.recievedFriendRequests.includes(
          new mongoose.Types.ObjectId(userId)
        )
      ) {
        res
          .status(400)
          .json({ success: false, message: "No friend request found" });
        return;
      }

      currentUser.recievedFriendRequests =
        currentUser.recievedFriendRequests.filter(
          (id) => id.toString() !== userId
        );

      friendUser.sentFriendRequests = currentUser.sentFriendRequests.filter(
        (id) => id.toString() !== req?.userId
      );

      await currentUser.save();
      await friendUser.save();

      // Find all posts related to the user
      const allPosts = await Post.find({
        $or: [{ author: userId }, { likes: userId }],
      })
        .select("content image likes comments createdAt author")
        .populate("author", "username profilePicture")
        .populate("likes", "username profilePicture")
        .populate("comments.user", "username profilePicture");

      // Filter posts by author
      const userPosts = allPosts.filter(
        (post) => post.author._id.toString() === userId
      );

      // Filter posts by likes
      const likedPosts = allPosts.filter((post) => {
        if (!post.likes) return false;
        return post.likes.some((like) => like._id.toString() === userId);
      });

      // Filter saved posts
      const savedPosts = allPosts.filter((post) => {
        if (!post.savedBy) return false;
        return post.savedBy.some((saved) => saved._id.toString() === userId);
      });

      res.json({
        message: "Friend request sent",
        otherUser: {
          ...friendUser.toObject(),
          posts: userPosts,
          likedPosts,
          savedPosts,
        },
        currentUser: currentUser,
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error rejecting friend request" });
    }
  }
);

// unfriend a user
router.post(
  "/friends/unfriend/:userId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const currentUser = await User.findById(req.userId).select("-password");
      const friendUser = await User.findById(userId).select("-password");

      if (!currentUser || !friendUser) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Remove each other from friends list
      currentUser.friends = currentUser.friends.filter(
        (id) => id.toString() !== userId
      );

      friendUser.friends = friendUser.friends.filter(
        (id) => id.toString() !== req.userId
      );

      await currentUser.save();
      await friendUser.save();

      // Find all posts related to the user
      const allPosts = await Post.find({
        $or: [{ author: userId }, { likes: userId }],
      })
        .select("content image likes comments createdAt author")
        .populate("author", "username profilePicture")
        .populate("likes", "username profilePicture")
        .populate("comments.user", "username profilePicture");

      // Filter posts by author
      const userPosts = allPosts.filter(
        (post) => post.author._id.toString() === userId
      );

      // Filter posts by likes
      const likedPosts = allPosts.filter((post) => {
        if (!post.likes) return false;
        return post.likes.some((like) => like._id.toString() === userId);
      });

      // Filter saved posts
      const savedPosts = allPosts.filter((post) => {
        if (!post.savedBy) return false;
        return post.savedBy.some((saved) => saved._id.toString() === userId);
      });

      res.json({
        message: "Friend request sent",
        otherUser: {
          ...friendUser.toObject(),
          posts: userPosts,
          likedPosts,
          savedPosts,
        },
        currentUser: currentUser,
      });
    } catch (error) {
      console.error("Error unfriending user:", error);
      res.status(500).json({
        success: false,
        message: "Error unfriending user",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

//get all friends
router.get(
  "/friends",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId)
        .populate("friends", "username email profilePicture isVerified")
        .populate(
          "pendingFriendRequests",
          "username email profilePicture isVerified"
        );

      res.json({
        friends: user?.friends || [],
        pendingRequests: user?.pendingFriendRequests || [],
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Error fetching friends" });
      console.log(error);
    }
  }
);

//get any user details
router.get(
  "/:userId",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      // Find user and populate posts
      const user = await User.findById(userId).select("-password");

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Find all posts related to the user
      const allPosts = await Post.find({
        $or: [{ author: userId }, { likes: userId }],
      })
        .select("content image likes comments createdAt author")
        .populate("author", "username profilePicture")
        .populate("likes", "username profilePicture")
        .populate("comments.user", "username profilePicture");

      // Filter posts by author
      const userPosts = allPosts.filter(
        (post) => post.author._id.toString() === userId
      );

      // Filter posts by likes
      const likedPosts = allPosts.filter((post) => {
        if (!post.likes) return false;
        return post.likes.some((like) => like._id.toString() === userId);
      });

      // Filter saved posts
      const savedPosts = allPosts.filter((post) => {
        if (!post.savedBy) return false;
        return post.savedBy.some((saved) => saved._id.toString() === userId);
      });

      // Convert user to plain object
      const userObject = user.toObject();

      res.json({
        ...userObject,
        posts: userPosts,
        likedPosts,
        savedPosts,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching user profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

//profile edit
router.put(
  "/profile/edit",
  auth,
  uploadImg.single("profilePicture"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req?.userId;
      // const userId = req.body.userId;
      const { username, bio, oldPassword, newPassword } = req.body;

      if (!userId) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // 1. Update username if provided and different
      if (username && username !== user.username) {
        const existing = await User.findOne({ username });
        if (existing) {
          res.status(400).json({ error: "Username already taken" });
          return;
        }
        user.username = username;
      }

      // 2. Update bio
      if (bio !== undefined) {
        user.bio = bio;
      }

      // 3. Update profile picture if uploaded
      if (req.file) {
        const imageUrl = await uploadImage(req.file.buffer);
        user.profilePicture = imageUrl;
      }

      // 4. Update password
      if (oldPassword && newPassword) {
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
          res.status(401).json({ error: "Old password is incorrect" });
          return;
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
      }

      await user.save();
      res.json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Something went wrong" });
    }
  }
);

export default router;
