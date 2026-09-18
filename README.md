# Fleet API

Backend for the "Add your fleet" 15-step wizard. Saves each step's data to
MongoDB and uploaded documents (Step 6) to S3, deployed on Render.

## 1. Local setup

```bash
cd fleet-api
npm install
cp .env.example .env
# fill in .env with your real MongoDB URI, S3 bucket, and allowed frontend origin(s)
npm run dev
```

Server runs at `http://localhost:4000`. Check `http://localhost:4000/health`.

## 2. Create the `fleetvehicles` collection in `tradepillr_qats`

This matches the collection style already in your database (`companydocuments`,
`customerdocuments`, `activities`, `notes`, etc.), visible in your Atlas Data
Explorer / Compass sidebar.

1. Fill in your real `MONGODB_URI` in `.env` — verify the full cluster
   hostname in Atlas under **Database → Connect → Drivers** (the sidebar
   screenshot only shows it truncated as `tradepillr.3bsch.mo...`).
2. Run:
   ```bash
   npm install
   npm run create-collection
   ```
3. This creates `fleetvehicles` with a validator (so it stays consistent
   with the app's schema) and indexes on VIN, registration number,
   `createdBy`, and wizard completion status. It's safe to re-run — it
   skips creation if the collection already exists.
4. Confirm in Atlas: refresh the `tradepillr_qats` database in the sidebar
   and you should see `fleetvehicles` listed alongside your other
   collections.

Once created, the rest of this API (steps 1–9, file uploads, etc.) reads
and writes to that same collection automatically — no further setup needed.

## 3. MongoDB Atlas network/user setup

1. In Atlas → **Database Access**, confirm your user (e.g.
   `tradiespec-local-qats-CODEX`) exists with a password and `readWrite` role
   on your database.
2. In Atlas → **Network Access**, add `0.0.0.0/0` (allow from anywhere).
   This is required because Render's outbound IPs are not static on most
   plans — Atlas can't be locked to a specific Render IP unless you're on a
   paid Render plan with a static outbound IP add-on. Access is still
   protected by the username/password.
3. Copy the connection string from **Database → Connect → Drivers** into
   `MONGODB_URI` in your `.env` (and later into Render's environment
   variables — see below).

## 4. File storage — where uploads go

**Do not store uploaded files as binary blobs in your normal MongoDB
documents.** MongoDB documents are capped at 16MB, and stuffing files in
bloats your database, slows queries, and makes backups huge. For the 7
document uploads in Step 6 (finance contract, tax invoice, etc.), this
project uses **S3** (or an S3-compatible provider):

- MongoDB stores only file **metadata** — original name, URL, size, MIME
  type — in the `documents` field on each fleet record.
- The actual file bytes live in an S3 bucket.
- The frontend uploads directly through this API, which streams the file to
  S3 and saves the resulting URL back to Mongo.

Any of these work as the "S3" in `.env` — just set `S3_ENDPOINT` for
non-AWS ones:
- **AWS S3** (leave `S3_ENDPOINT` blank)
- **Cloudflare R2** (cheaper, no egress fees — good fit if the client is cost-sensitive)
- **DigitalOcean Spaces**

If you'd rather avoid a separate storage account entirely, an alternative
is **MongoDB GridFS** (built into MongoDB, no S3 setup needed) — good for
low file volume, but slower and clunkier for downloads than S3. Ask me for
the GridFS version of `middleware/upload.js` if you'd prefer that route
instead.

## 5. Deploy to Render

### Option A — Blueprint (recommended, uses `render.yaml` already in this repo)

1. Push this project to a GitHub/GitLab repo.
2. In Render dashboard → **New → Blueprint**, connect the repo. Render reads
   `render.yaml` automatically and creates the web service.
3. Render will prompt you to fill in the env vars marked `sync: false`
   (`MONGODB_URI`, `ALLOWED_ORIGINS`, the `S3_*` keys) — paste your real
   values there. **Never commit `.env` to the repo.**
4. Click **Apply**. First deploy takes a few minutes.

### Option B — Manual web service

1. Render dashboard → **New → Web Service** → connect your repo.
2. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
3. Add the same environment variables listed in `.env.example` under
   **Environment** in the Render dashboard.
4. Set **Health Check Path** to `/health`.
5. Deploy.

### Notes specific to Render

- Render assigns the port via `process.env.PORT` automatically — this
  project already binds to it (`src/server.js`), so don't hardcode a port.
- The **free plan spins down after 15 minutes of inactivity** and takes
  ~30-50s to wake on the next request — fine for a demo/QA stage, but for
  the client's production use, use at least the **Starter** plan so the API
  doesn't cold-start on every form submission.
- Once deployed, your API's base URL will look like
  `https://fleet-api-xxxx.onrender.com`. Use that as `API_BASE_URL` in the
  frontend code below.

## 6. Calling this API from the Lovable frontend

Since Lovable doesn't have a native MongoDB connector, the form's `onSubmit`
handlers should call this API directly with `fetch`. Example for Step 1
(Vehicle) creating the record, and Step 2 onward updating it:

```javascript
const API_BASE_URL = "https://fleet-api-xxxx.onrender.com";

// Step 1 — create the fleet record, keep the returned _id for later steps
async function submitStep1(vehicleData) {
  const res = await fetch(`${API_BASE_URL}/api/fleet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle: vehicleData }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  const fleet = await res.json();
  return fleet._id; // store this (e.g. in state/localStorage) for the rest of the wizard
}

// Steps 2, 3, 4, 7, 8, 9 — update one section at a time
async function submitStep(fleetId, stepNumber, fields) {
  const res = await fetch(`${API_BASE_URL}/api/fleet/${fleetId}/step/${stepNumber}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Step 6 — Vehicle Documents (file uploads)
async function submitStep6(fleetId, filesByField) {
  const formData = new FormData();
  for (const [fieldName, file] of Object.entries(filesByField)) {
    if (file) formData.append(fieldName, file);
  }
  const res = await fetch(`${API_BASE_URL}/api/fleet/${fleetId}/documents`, {
    method: "POST",
    body: formData, // no Content-Type header — the browser sets the multipart boundary
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

// Final step — mark the wizard complete
async function completeWizard(fleetId) {
  const res = await fetch(`${API_BASE_URL}/api/fleet/${fleetId}/complete`, { method: "POST" });
  return res.json();
}
```

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/fleet` | Create record from Step 1 (Vehicle) |
| PATCH | `/api/fleet/:id/step/:stepNumber` | Save Steps 2, 3, 4, 5, 7, 8, 9 |
| POST | `/api/fleet/:id/documents` | Save Step 6 (file uploads, multipart) |
| POST | `/api/fleet/:id/complete` | Mark wizard finished |
| GET | `/api/fleet/:id` | Fetch one record (resume wizard) |
| GET | `/api/fleet?page=&limit=` | List records, paginated |
| GET | `/health` | Render health check |
