const mongoose = require("mongoose");

/**
 * A sub-document shape for any uploaded file.
 * We never store the raw file bytes in MongoDB — only the metadata and the
 * URL pointing at the file in S3 (see src/middleware/upload.js).
 */
const FileMetaSchema = new mongoose.Schema(
  {
    originalName: String,
    url: String, // public/CDN URL, or a signed URL if bucket is private
    key: String, // S3 object key, needed later to delete/re-sign the file
    mimeType: String,
    sizeBytes: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FleetSchema = new mongoose.Schema(
  {
    // ---------- Step 1 of 15 · Vehicle ----------
    vehicle: {
      make: String,
      model: String,
      year: Number,
      colour: String,
      vehicleSpecifications: String,
      fleetNote: String,
      vehicleReference: String,
      staffUse: String,
      stockLot: String,
      vin: { type: String, trim: true, uppercase: true },
      engineNumber: String,
      keyNumber: String,
      radioCode: String,
      uniqueIdentifier: String,
      fuelType: String, // e.g. Petrol, Diesel, Electric, Hybrid
      transmission: String, // e.g. Automatic, Manual
      bodyType: String, // e.g. Ute, Van, Sedan
      hireType: String,
      category: String,
    },

    // ---------- Step 2 of 15 · Registration ----------
    registration: {
      stateOfRegistration: String,
      registrationNumber: String,
      regoChangeReason: String,
      registrationFee: Number,
      registrationExpiryDate: Date,
    },

    // ---------- Step 3 of 15 · Status & Location ----------
    statusLocation: {
      expectedArrivalDate: Date,
      dateReceived: Date,
      fleetStatus: String, // e.g. Active, In Transit, Sold, Workshop
      currentLocation: String,
      currentFuelLevelPercent: Number,
      fuelCapacityLitres: Number,
      currentKms: Number,
      kmLastUpdated: Date,
    },

    // ---------- Step 4 of 15 · Keys, Log Book & Notes ----------
    keysLogBookNotes: {
      numberOfKeys: Number,
      hasLogBook: Boolean,
      logBookLocation: String,
      spareKeyLocation: String,
      accessories: String,
      notes: String,
    },

    // ---------- Step 5 of 15 · Contracted Services ----------
    contractedServices: {
      rentToOwn4Years: Number,
      rentToOwn5Years: Number,
    },

    // ---------- Step 6 of 15 · Vehicle Documents (uploaded files) ----------
    documents: {
      financeContract: FileMetaSchema,
      dealerTaxInvoice: FileMetaSchema,
      fleetManagementContract: FileMetaSchema,
      ctpInsuranceSchedule: FileMetaSchema,
      registrationCertificate: FileMetaSchema,
      dealerVehicleQuote: FileMetaSchema,
      financierTaxInvoice: FileMetaSchema,
    },

    // ---------- Step 7 of 15 · Vehicle Purchase ----------
    purchase: {
      vehicleOwned: Boolean,
      company: String,
      dealerPurchaseFrom: String,
      purchaseDate: Date,
      purchasePrice: Number,
      odometerReading: Number,
      deliveryLocation: String,
      note: String,
    },

    // ---------- Step 8 of 15 · Vehicle Finance ----------
    finance: {
      financeCompany: String,
      typeOfFinance: String,
      contractStartDate: Date,
      contractEndDate: Date,
      depositPaid: Number,
      residualValue: Number,
      termMonths: Number,
      methodOfPayment: String,
      amountFinanced: Number,
      monthlyPayment: Number,
      serviceLeaseFee: Number,
      servicePackageFeeMonthly: Number,
      depreciationRatePercent: Number,
      dateOrdered: Date,
      dateDelivery: Date,
    },

    // ---------- Step 9 of 15 · Vehicle Insurance ----------
    insurance: {
      insurer: String,
      insurancePolicy: String,
      policyNumber: String,
      insuredAmount: String, // "Select" dropdown in the UI — keep as string/enum
      monthlyPayment: Number,
      annualInsurancePremium: Number,
      deductible: Number,
      startDate: Date,
      endDate: Date, // auto-calculated in the UI
    },

    // ---------- Step 10 of 15 · Telematics ----------
    telematics: {
      telematicsId: String,
      telematicsDevice: String,
      telematicsStatus: String,
      addressLine1: String,
      addressLine2: String,
      cityDistrict: String,
      stateProvince: String,
      postalCode: String,
      country: String,
      lastKnownAddressDateUpdated: Date,
      lastKnownAddressTimeUpdated: String, // stored as a time string, e.g. "14:30"
      latitude: Number,
      longitude: Number,
      monthlyTelemaxFee: Number,
    },

    // ---------- Step 11 of 15 · Maintenance ----------
    maintenance: {
      fleetManagement: String,
      serviceDueDate: Date,
      daysUntilServiceDue: Number,
      serviceDueKms: Number,
      previousServiceDueKms: Number,
      kmsUntilNextService: Number,
      webVehicleId: String,
    },

    // ---------- Step 12 of 15 · Onboarding Checklist – Fleet ----------
    onboardingFleet: {
      addedToTollProvider: Boolean,
      regoCheck: Boolean,
      telematicsDeviceConnected: Boolean,
      registerTelemaxUnitInApp: Boolean,
      addServiceRemindersInTelemax: Boolean,
      vehicleAsPerOrder: Boolean,
    },

    // ---------- Step 13 of 15 · Onboarding Checklist – Operations ----------
    onboardingOperations: {
      vehicleInspectionCompleted: Boolean,
      stickersAddedToVehicle: Boolean,
      gpsUnitInstalled: Boolean,
      mudFlapsInstalled: Boolean,
      vehicleSpecsMatch: Boolean,
      keyTagsLabelled: Boolean,
      logBookLabelled: Boolean,
      spareKeyStored: Boolean,
      logBookStored: Boolean,
      vehicleAsPerInvoice: Boolean,
    },

    // ---------- Step 14 of 15 · Vehicle Photos ----------
    // "Add at least 10 photos" — an array since it's a gallery, not one file per field
    // like Step 6's documents.
    photos: [FileMetaSchema],

    // ---------- Wizard bookkeeping ----------
    // Lets the frontend save-and-resume a partially filled 15-step wizard.
    wizard: {
      currentStep: { type: Number, default: 1, min: 1, max: 15 },
      isComplete: { type: Boolean, default: false },
    },

    // Whoever is submitting this (from your auth/session) — adjust to match
    // however Lovable/your auth provider identifies the logged-in user.
    createdBy: String,
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// Explicit collection name to match your existing tradepillr_qats naming
// convention (companydocuments, customerdocuments, activities, notes, etc.)
module.exports = mongoose.model("Fleet", FleetSchema, "fleetvehicles");