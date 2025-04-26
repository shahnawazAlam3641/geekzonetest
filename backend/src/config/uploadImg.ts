import { v2 as cloudinary } from "cloudinary";
import { UploadApiResponse } from "cloudinary";

import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_KEY!,
  api_secret: process.env.CLOUDINARY_SECRET!,
});

export const uploadImage = async (
  buffer: Buffer,
  folder: string = "profile_pictures"
): Promise<string> => {
  const streamUpload = (): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Upload failed"));
          resolve(result);
        }
      );

      stream.end(buffer);
    });
  };

  const result = await streamUpload();
  return result.secure_url;
};
