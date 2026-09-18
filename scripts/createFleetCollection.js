/**
 * Setup/update script — creates the `fleetvehicles` collection in
 * tradepillr_qats if it doesn't exist, or updates its validator in place
 * if it does. The validator now checks every individual field from all
 * 9 "Add your fleet" wizard steps, not just the top-level section shape.
 *
 * Usage:
 *   Fill MONGODB_URI into .env, then: npm run create-collection
 *   (safe to re-run any time you add/change fields — it always re-applies
 *   the latest validator via collMod)
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");

const COLLECTION_NAME = "fleetvehicles";

// A permissive "value" type covering string/number-ish fields the UI stores
// as strings (e.g. "Insured Amount" is a Select dropdown, "Purchase Price"
// might come in as text) — kept loose enough not to reject valid submissions
// mid-wizard, while still catching structurally wrong data (arrays, etc).
const str = { bsonType: ["string", "null"] };
const num = { bsonType: ["double", "int", "long", "decimal", "null"] };
const dateOrStr = { bsonType: ["date", "string", "null"] }; // UI sends mm/dd/yyyy as string
const bool = { bsonType: ["bool", "null"] };

const fileMeta = {
  bsonType: ["object", "null"],
  properties: {
    originalName: str,
    url: str,
    key: str,
    mimeType: str,
    sizeBytes: num,
    uploadedAt: dateOrStr,
  },
};

const validatorSchema = {
  $jsonSchema: {
    bsonType: "object",
    properties: {
      // ---- Step 1 of 15 · Vehicle ----
      vehicle: {
        bsonType: ["object", "null"],
        properties: {
          make: str,
          model: str,
          year: num,
          colour: str,
          vehicleSpecifications: str,
          fleetNote: str,
          vehicleReference: str,
          staffUse: str,
          stockLot: str,
          vin: str,
          engineNumber: str,
          keyNumber: str,
          radioCode: str,
          uniqueIdentifier: str,
          fuelType: str,
          transmission: str,
          bodyType: str,
          hireType: str,
          category: str,
        },
      },

      // ---- Step 2 of 15 · Registration ----
      registration: {
        bsonType: ["object", "null"],
        properties: {
          stateOfRegistration: str,
          registrationNumber: str,
          regoChangeReason: str,
          registrationFee: num,
          registrationExpiryDate: dateOrStr,
        },
      },

      // ---- Step 3 of 15 · Status & Location ----
      statusLocation: {
        bsonType: ["object", "null"],
        properties: {
          expectedArrivalDate: dateOrStr,
          dateReceived: dateOrStr,
          fleetStatus: str,
          currentLocation: str,
          currentFuelLevelPercent: num,
          fuelCapacityLitres: num,
          currentKms: num,
          kmLastUpdated: dateOrStr,
        },
      },

      // ---- Step 4 of 15 · Keys, Log Book & Notes ----
      keysLogBookNotes: {
        bsonType: ["object", "null"],
        properties: {
          numberOfKeys: num,
          hasLogBook: bool,
          logBookLocation: str,
          spareKeyLocation: str,
          accessories: str,
          notes: str,
        },
      },

      // ---- Step 5 of 15 · Contracted Services ----
      contractedServices: {
        bsonType: ["object", "null"],
        properties: {
          rentToOwn4Years: num,
          rentToOwn5Years: num,
        },
      },

      // ---- Step 6 of 15 · Vehicle Documents (uploaded files) ----
      documents: {
        bsonType: ["object", "null"],
        properties: {
          financeContract: fileMeta,
          dealerTaxInvoice: fileMeta,
          fleetManagementContract: fileMeta,
          ctpInsuranceSchedule: fileMeta,
          registrationCertificate: fileMeta,
          dealerVehicleQuote: fileMeta,
          financierTaxInvoice: fileMeta,
        },
      },

      // ---- Step 7 of 15 · Vehicle Purchase ----
      purchase: {
        bsonType: ["object", "null"],
        properties: {
          vehicleOwned: bool,
          company: str,
          dealerPurchaseFrom: str,
          purchaseDate: dateOrStr,
          purchasePrice: num,
          odometerReading: num,
          deliveryLocation: str,
          note: str,
        },
      },

      // ---- Step 8 of 15 · Vehicle Finance ----
      finance: {
        bsonType: ["object", "null"],
        properties: {
          financeCompany: str,
          typeOfFinance: str,
          contractStartDate: dateOrStr,
          contractEndDate: dateOrStr,
          depositPaid: num,
          residualValue: num,
          termMonths: num,
          methodOfPayment: str,
          amountFinanced: num,
          monthlyPayment: num,
          serviceLeaseFee: num,
          servicePackageFeeMonthly: num,
          depreciationRatePercent: num,
          dateOrdered: dateOrStr,
          dateDelivery: dateOrStr,
        },
      },

      // ---- Step 9 of 15 · Vehicle Insurance ----
      insurance: {
        bsonType: ["object", "null"],
        properties: {
          insurer: str,
          insurancePolicy: str,
          policyNumber: str,
          insuredAmount: str, // "Select" dropdown in the UI
          monthlyPayment: num,
          annualInsurancePremium: num,
          deductible: num,
          startDate: dateOrStr,
          endDate: dateOrStr, // auto-calculated in the UI
        },
      },

      // ---- Step 10 of 15 · Telematics ----
      telematics: {
        bsonType: ["object", "null"],
        properties: {
          telematicsId: str,
          telematicsDevice: str,
          telematicsStatus: str,
          addressLine1: str,
          addressLine2: str,
          cityDistrict: str,
          stateProvince: str,
          postalCode: str,
          country: str,
          lastKnownAddressDateUpdated: dateOrStr,
          lastKnownAddressTimeUpdated: str,
          latitude: num,
          longitude: num,
          monthlyTelemaxFee: num,
        },
      },

      // ---- Step 11 of 15 · Maintenance ----
      maintenance: {
        bsonType: ["object", "null"],
        properties: {
          fleetManagement: str,
          serviceDueDate: dateOrStr,
          daysUntilServiceDue: num,
          serviceDueKms: num,
          previousServiceDueKms: num,
          kmsUntilNextService: num,
          webVehicleId: str,
        },
      },

      // ---- Step 12 of 15 · Onboarding Checklist – Fleet ----
      onboardingFleet: {
        bsonType: ["object", "null"],
        properties: {
          addedToTollProvider: bool,
          regoCheck: bool,
          telematicsDeviceConnected: bool,
          registerTelemaxUnitInApp: bool,
          addServiceRemindersInTelemax: bool,
          vehicleAsPerOrder: bool,
        },
      },

      // ---- Step 13 of 15 · Onboarding Checklist – Operations ----
      onboardingOperations: {
        bsonType: ["object", "null"],
        properties: {
          vehicleInspectionCompleted: bool,
          stickersAddedToVehicle: bool,
          gpsUnitInstalled: bool,
          mudFlapsInstalled: bool,
          vehicleSpecsMatch: bool,
          keyTagsLabelled: bool,
          logBookLabelled: bool,
          spareKeyStored: bool,
          logBookStored: bool,
          vehicleAsPerInvoice: bool,
        },
      },

      // ---- Step 14 of 15 · Vehicle Photos ----
      photos: {
        bsonType: ["array", "null"],
        items: fileMeta,
      },

      // ---- Wizard bookkeeping ----
      wizard: {
        bsonType: ["object", "null"],
        properties: {
          currentStep: { bsonType: ["int", "long"] },
          isComplete: bool,
        },
      },

      createdBy: str,
      createdAt: { bsonType: ["date", "null"] },
      updatedAt: { bsonType: ["date", "null"] },
    },
  },
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set (add it to .env or pass it inline).");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(); // uses the DB name already in the URI (tradepillr_qats)

    const existing = await db.listCollections({ name: COLLECTION_NAME }).toArray();

    if (existing.length > 0) {
      // Collection already exists — update its validator in place with collMod.
      await db.command({
        collMod: COLLECTION_NAME,
        validator: validatorSchema,
        validationLevel: "moderate", // only checks new/modified fields, won't reject partially-filled wizard docs
        validationAction: "warn",    // logs mismatches instead of rejecting writes — flip to "error" once you trust the shape
      });
      console.log(`Updated validator on existing collection "${COLLECTION_NAME}".`);
    } else {
      await db.createCollection(COLLECTION_NAME, {
        validator: validatorSchema,
        validationLevel: "moderate",
        validationAction: "warn",
      });
      console.log(`Created collection "${COLLECTION_NAME}" in database "${db.databaseName}".`);
    }

    const coll = db.collection(COLLECTION_NAME);

    // Helpful indexes: fast lookup by VIN, by registration number, by owner,
    // and by wizard completion status for "resume/incomplete" dashboards.
    await coll.createIndexes([
      { key: { "vehicle.vin": 1 }, name: "vin_idx", sparse: true },
      { key: { "registration.registrationNumber": 1 }, name: "registration_number_idx", sparse: true },
      { key: { createdBy: 1 }, name: "created_by_idx", sparse: true },
      { key: { "wizard.isComplete": 1 }, name: "wizard_complete_idx" },
      { key: { createdAt: -1 }, name: "created_at_idx" },
    ]);
    console.log("Indexes created/confirmed.");

    console.log("Existing collections in this database:");
    const all = await db.listCollections().toArray();
    all.forEach((c) => console.log(" -", c.name));
  } catch (err) {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();