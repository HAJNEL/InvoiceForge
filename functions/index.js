/**
 * Cloud Function entry point for InvoiceForge.
 *
 * The whole Express backend lives in ../server.ts and is bundled into
 * ./lib/server.cjs by `npm run build:functions` (esbuild). We import the
 * exported Express `app` and expose it as a single HTTPS function named `api`.
 *
 * Firebase Hosting rewrites /api/** to this function (see firebase.json), so
 * the frontend can keep calling relative `/api/...` URLs unchanged.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// API keys are stored in Cloud Secret Manager and exposed to the function as
// environment variables at runtime. Set them once with, e.g.:
//   firebase functions:secrets:set XAI_API_KEY
const XAI_API_KEY = defineSecret("XAI_API_KEY");
const LLAMA_CLOUD_API_KEY = defineSecret("LLAMA_CLOUD_API_KEY");

const { app } = require("./lib/server.cjs");

exports.api = onRequest(
  {
    region: "us-central1",
    // PDF extraction / external LLM calls can be slow.
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [XAI_API_KEY, LLAMA_CLOUD_API_KEY],
  },
  app
);
