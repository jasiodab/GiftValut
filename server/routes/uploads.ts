import { Router } from "express";
import multer from "multer";
import { asyncHandler, AppError } from "../lib/errors";
import { saveImageBuffer } from "../services/images";
import { requestUserId } from "../lib/requestUser";

export const uploadsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});

uploadsRouter.post(
  "/image",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "Choose an image to upload.", "NO_IMAGE");
    try {
      const saved = await saveImageBuffer(req.file.buffer, requestUserId(req), req.file.mimetype);
      res.status(201).json({ imagePath: saved.path, mimeType: saved.mimeType });
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : "The image could not be saved.", "INVALID_IMAGE");
    }
  })
);
