import multer from "multer";
import { PHOTO_LIMIT } from "../services/photo-service.js";
import { AppError } from "../lib/errors.js";
const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_LIMIT, files: 1, fields: 0, parts: 1 },
}).single("photo");
export function photoUpload(req, res, next) {
  receive(req, res, (error) => {
    if (!error) return next();
    const large = error.code === "LIMIT_FILE_SIZE";
    next(
      new AppError(
        422,
        large
          ? "Choose a photo smaller than 5 MB."
          : "Upload one photo using the photo field.",
        large ? "PHOTO_TOO_LARGE" : "INVALID_PHOTO",
        {
          photo: large
            ? "Maximum size is 5 MB."
            : "Choose one JPEG, PNG or WebP photo.",
        },
      ),
    );
  });
}
