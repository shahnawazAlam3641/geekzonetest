import multer from "multer";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const storage = multer.memoryStorage();

export const uploadImg = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP formats are allowed"));
    }
  },
});
