import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the canonical modular backend app from functions/index.js
const { app } = require("../functions/index.js");

const PORT = process.env.PORT || 5177;
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(` CivicConnect Production Backend API Server Online`);
  console.log(` Port: ${PORT} (0.0.0.0)`);
  console.log(` Single Source of Truth: Supabase PostgreSQL & Firebase Auth`);
  console.log(` Status: Production-Hardened, Zero Mock Fallback`);
  console.log(`=======================================================`);
});

export default app;
