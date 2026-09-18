const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

// The 7 document fields from "Step 6 of 15 · Vehicle Documents"
const DOCUMENT_FIELDS = [
  "financeContract",
  "dealerTaxInvoice",
  "fleetManagementContract",
  "ctpInsuranceSchedule",
  "registrationCertificate",
  "dealerVehicleQuote",
  "financierTaxInvoice",
];

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
};

const isS3Configured = Boolean(process.env.S3_BUCKET);

let storage;
let usingS3 = false;

if (isS3Configured) {
  // --- S3 storage (used automatically once S3_* env vars are set) ---
  const multerS3 = require("multer-s3");
  const { S3Client } = require("@aws-sdk/client-s3");

  const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    // Only set if using a non-AWS S3-compatible provider (R2, Spaces, MinIO...)
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  });

  storage = multerS3({
    s3,
    bucket: process.env.S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const fleetId = req.params.id || "new";
      const ext = path.extname(file.originalname);
      cb(null, `fleet/${fleetId}/${file.fieldname}/${uuidv4()}${ext}`);
    },
  });
  usingS3 = true;
} else {
  // --- Local disk fallback (dev/testing only — see note below) ---
  console.warn(
    "[upload] S3_BUCKET is not set — falling back to local disk storage at ./uploads. " +
      "This is fine for local testing, but files won't persist on Render (ephemeral " +
      "filesystem) or survive a redeploy. Set S3_BUCKET/S3_REGION/S3_ACCESS_KEY_ID/" +
      "S3_SECRET_ACCESS_KEY in .env before deploying so uploads use S3 instead."
  );

  const uploadsRoot = path.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadsRoot, { recursive: true });

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const fleetId = req.params.id || "new";
      const dir = path.join(uploadsRoot, "fleet", fleetId, file.fieldname);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter,
});

// Accepts one file per named document field, matching the UI's 7 upload slots
const uploadDocuments = upload.fields(
  DOCUMENT_FIELDS.map((name) => ({ name, maxCount: 1 }))
);

// Step 14 · Vehicle Photos — up to 10 images under a single "photos" field
const uploadPhotos = upload.array("photos", 10);

/**
 * Turns multer's req.files into the FileMeta shape our Mongoose schema expects,
 * keyed by document field name — ready to merge into `documents.<field>`.
 * Works for both the S3 branch (file.location/file.key) and the local disk
 * branch (file.path), producing a usable `url` either way.
 */
function filesToDocumentsPatch(files, req) {
  const patch = {};
  if (!files) return patch;

  for (const field of DOCUMENT_FIELDS) {
    const fileArr = files[field];
    if (fileArr && fileArr[0]) {
      const f = fileArr[0];
      const relativePath = usingS3
        ? null
        : path.relative(process.cwd(), f.path).split(path.sep).join("/");

      patch[`documents.${field}`] = {
        originalName: f.originalname,
        url: usingS3 ? f.location : `${req.protocol}://${req.get("host")}/${relativePath}`,
        key: usingS3 ? f.key : relativePath,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        uploadedAt: new Date(),
      };
    }
  }
  return patch;
}

/**
 * Turns an array of uploaded photo files (Step 14) into FileMeta objects,
 * ready to $push (or replace) into the `photos` array field.
 */
function photosToFileMetaArray(files, req) {
  if (!files || files.length === 0) return [];
  return files.map((f) => {
    const relativePath = usingS3 ? null : path.relative(process.cwd(), f.path).split(path.sep).join("/");
    return {
      originalName: f.originalname,
      url: usingS3 ? f.location : `${req.protocol}://${req.get("host")}/${relativePath}`,
      key: usingS3 ? f.key : relativePath,
      mimeType: f.mimetype,
      sizeBytes: f.size,
      uploadedAt: new Date(),
    };
  });
}

module.exports = {
  uploadDocuments,
  uploadPhotos,
  filesToDocumentsPatch,
  photosToFileMetaArray,
  DOCUMENT_FIELDS,
  usingS3,
};