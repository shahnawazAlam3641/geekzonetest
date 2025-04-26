import express, { Request, Response } from "express";
import { auth } from "../middleware/auth";
import { enhanceText } from "../config/ai";

const router = express.Router();

router.post("/enhanceText", auth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      res
        .status(401)
        .json({ success: true, message: "Prompt cannot be Empty" });
      return;
    }

    const response =
      await enhanceText(`Please rewrite and enhance the following social media post to make it more engaging, expressive, and natural while preserving the original meaning. Avoid making it too formal or robotic. in response send only enhanced text nothing else. If the post is too short (less than 5 words), respond with: 'Text too short to enhance, please add a bit more.'
Here’s the text:
'${prompt}'`);
    res.json({ enhancedText: response });
  } catch (error) {
    console.log(error);
  }
});

export default router;
