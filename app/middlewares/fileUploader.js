// //app/middlewares/fileUploader.js
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const BASE_PATH = path.join(__dirname, "../uploads");

export const imageConversionMiddlewareMultiple = (req, res, next) => {
  if (!fs.existsSync(BASE_PATH)) {
    fs.mkdirSync(BASE_PATH, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, BASE_PATH),
    filename: (req, file, cb) => {
      const fileNameWithoutExt = path.parse(file.originalname).name;
      cb(null, `${fileNameWithoutExt}-${Date.now()}${path.extname(file.originalname)}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 5 }, 
    fileFilter: (req, file, cb) => cb(null, true), 
  });

  upload.any()(req, res, async (err) => {
    if (err) {
      console.error("Upload Error:", err);
      return res.status(400).send({ message: "File upload failed." });
    }

    const convertedFiles = {};

    try {
      if (Array.isArray(req.files)) {
        let imageUrls = [];

        for (const file of req.files) {
          const uploadedFilePath = path.join(BASE_PATH, file.filename);
          const ext = path.extname(file.originalname).toLowerCase();
          const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);

          let finalFileName;

          if (isImage) {
            finalFileName = `${Date.now()}-${path.parse(file.originalname).name}.webp`;
            const webpFilePath = path.join(BASE_PATH, finalFileName);

            await sharp(uploadedFilePath)
              .webp({ quality: 80 })
              .toFile(webpFilePath);

            fs.unlinkSync(uploadedFilePath);
          } else {
            finalFileName = file.filename; 
          }

          imageUrls.push(`http://192.168.0.14:8000/media/${encodeURIComponent(finalFileName)}`);
        }

        if (imageUrls.length === 6) {
          convertedFiles.images = imageUrls;
        } else {
          return res.status(400).send({ message: "Exactly 6 images are required." });
        }
      }

      req.convertedFiles = convertedFiles;
      next();
    } catch (error) {
      console.error("Conversion error:", error);
      return res.status(500).send({ message: "Error processing media files." });
    }
  });
};
