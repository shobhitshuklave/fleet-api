const express = require("express");
const mongoose = require("mongoose");
const Fleet = require("../models/Fleet");
const {
  uploadDocuments,
  uploadPhotos,
  filesToDocumentsPatch,
  photosToFileMetaArray,
} = require("../middleware/upload");

const router = express.Router();

// Maps each wizard step number to the schema section it writes to.
// Steps not listed here (6, 14, 15) are handled separately below.
const STEP_TO_SECTION = {
  1: "vehicle",
  2: "registration",
  3: "statusLocation",
  4: "keysLogBookNotes",
  5: "contractedServices",
  7: "purchase",
  8: "finance",
  9: "insurance",
  10: "telematics",
  11: "maintenance",
  12: "onboardingFleet",
  13: "onboardingOperations",
};

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * POST /api/fleet
 * Starts a new fleet record (called once, e.g. when the user submits Step 1).
 * Body: { vehicle: {...} }
 */
router.post("/", async (req, res) => {
  try {
    const fleet = await Fleet.create({
      vehicle: req.body.vehicle || {},
      wizard: { currentStep: 2, isComplete: false },
      createdBy: req.body.createdBy, // pass the logged-in user's id from the frontend
    });
    res.status(201).json(fleet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/fleet/:id/step/:stepNumber
 * Saves the fields for a single wizard step (steps 1-4, 7-9).
 * Body: the raw field object for that step, e.g. { make, model, year, ... }
 */
router.patch("/:id/step/:stepNumber", async (req, res) => {
  const { id, stepNumber } = req.params;
  const step = Number(stepNumber);

  if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid fleet id" });
  const section = STEP_TO_SECTION[step];
  if (!section) return res.status(400).json({ error: `Unhandled step: ${step}` });

  try {
    const fleet = await Fleet.findByIdAndUpdate(
      id,
      {
        $set: { [section]: req.body },
        "wizard.currentStep": Math.min(step + 1, 15),
      },
      { new: true, runValidators: true }
    );
    if (!fleet) return res.status(404).json({ error: "Fleet record not found" });
    res.json(fleet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/fleet/:id/documents
 * Step 6 of 15 · Vehicle Documents — handles the 7 file inputs together.
 * multipart/form-data with field names: financeContract, dealerTaxInvoice,
 * fleetManagementContract, ctpInsuranceSchedule, registrationCertificate,
 * dealerVehicleQuote, financierTaxInvoice
 */
router.post("/:id/documents", uploadDocuments, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid fleet id" });

  try {
    const patch = filesToDocumentsPatch(req.files, req);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No files were uploaded" });
    }

    const fleet = await Fleet.findByIdAndUpdate(
      id,
      { $set: { ...patch, "wizard.currentStep": 7 } },
      { new: true }
    );
    if (!fleet) return res.status(404).json({ error: "Fleet record not found" });
    res.json(fleet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/fleet/:id/photos
 * Step 14 of 15 · Vehicle Photos — up to 10 images, appended to the gallery.
 * multipart/form-data, field name: photos (repeat the field for each file)
 */
router.post("/:id/photos", uploadPhotos, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid fleet id" });

  try {
    const newPhotos = photosToFileMetaArray(req.files, req);
    if (newPhotos.length === 0) {
      return res.status(400).json({ error: "No photos were uploaded" });
    }

    const fleet = await Fleet.findByIdAndUpdate(
      id,
      {
        $push: { photos: { $each: newPhotos } },
        $set: { "wizard.currentStep": 15 },
      },
      { new: true }
    );
    if (!fleet) return res.status(404).json({ error: "Fleet record not found" });

    if (fleet.photos.length > 10) {
      return res.status(400).json({
        error: `Photo limit exceeded: ${fleet.photos.length}/10. Remove some before adding more.`,
        fleet,
      });
    }

    res.json(fleet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/fleet/:id/complete
 * Called on the final step to mark the wizard as finished.
 */
router.post("/:id/complete", async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return res.status(400).json({ error: "Invalid fleet id" });

  const fleet = await Fleet.findByIdAndUpdate(
    id,
    { $set: { "wizard.isComplete": true, "wizard.currentStep": 15 } },
    { new: true }
  );
  if (!fleet) return res.status(404).json({ error: "Fleet record not found" });
  res.json(fleet);
});

/**
 * GET /api/fleet/:id
 * Fetch one fleet record (e.g. to resume an in-progress wizard).
 */
router.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid fleet id" });
  const fleet = await Fleet.findById(req.params.id);
  if (!fleet) return res.status(404).json({ error: "Fleet record not found" });
  res.json(fleet);
});

/**
 * GET /api/fleet
 * List fleet records (paginated), newest first.
 */
router.get("/", async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const [items, total] = await Promise.all([
    Fleet.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Fleet.countDocuments(),
  ]);

  res.json({ items, total, page, limit });
});

module.exports = router;