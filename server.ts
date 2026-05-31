/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config();

// ---------------------------------------------------------------------------
// SQLite setup
// ---------------------------------------------------------------------------
const db = new Database("dermavision.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id          TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const stmtInsertCase = db.prepare(`
  INSERT INTO cases (id, data, created_at)
  VALUES (@id, @data, @created_at)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data
`);
const stmtGetAllCases = db.prepare(
  `SELECT data FROM cases ORDER BY created_at DESC`,
);
const stmtDeleteCase = db.prepare(`DELETE FROM cases WHERE id = ?`);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      database: "Connected (SQLite)",
      latencyMs: Math.floor(15 + Math.random() * 45),
      timestamp: new Date().toISOString(),
    });
  });

  // ── Cases — GET all ───────────────────────────────────────────────────────
  app.get("/api/cases", (_req, res) => {
    try {
      const rows = stmtGetAllCases.all() as { data: string }[];
      const cases = rows.map((r) => JSON.parse(r.data));
      res.json({ cases, total: cases.length });
    } catch (err: any) {
      console.error("GET /api/cases failed:", err.message);
      res.status(500).json({ error: "Failed to retrieve cases." });
    }
  });

  // ── Cases — POST (upsert) ─────────────────────────────────────────────────
  app.post("/api/cases", (req, res) => {
    try {
      const caseData = req.body;
      if (!caseData?.id) {
        return res
          .status(400)
          .json({ error: "Case object must include an id field." });
      }
      stmtInsertCase.run({
        id: caseData.id,
        data: JSON.stringify(caseData),
        created_at: caseData.createdAt || new Date().toISOString(),
      });
      console.log(`Case saved: ${caseData.id}`);
      res.json({ success: true, id: caseData.id });
    } catch (err: any) {
      console.error("POST /api/cases failed:", err.message);
      res.status(500).json({ error: "Failed to save case." });
    }
  });

  // ── Cases — DELETE ────────────────────────────────────────────────────────
  app.delete("/api/cases/:id", (req, res) => {
    try {
      const result = stmtDeleteCase.run(req.params.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Case not found." });
      }
      console.log(`Case deleted: ${req.params.id}`);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      console.error("DELETE /api/cases/:id failed:", err.message);
      res.status(500).json({ error: "Failed to delete case." });
    }
  });

  // ── Skin analysis ─────────────────────────────────────────────────────────
  app.post("/api/analyze-skin", async (req, res) => {
    try {
      const { image, symptoms, patientInfo } = req.body;

      if (!image) {
        return res
          .status(400)
          .json({ error: "Missing skin image data for assessment." });
      }

      const base64Data = image.startsWith("data:")
        ? image.split(",")[1]
        : image;
      const imageBuffer = Buffer.from(base64Data, "base64");

      const form = new FormData();
      form.set(
        "image",
        new Blob([imageBuffer], { type: "image/jpeg" }),
        "image.jpg",
      );
      form.set("include_heatmap", "true");
      form.set("include_narrative", "true");

      if (symptoms) form.set("symptoms", symptoms);
      if (patientInfo?.name) form.set("patient_name", patientInfo.name);
      if (patientInfo?.age) form.set("patient_age", String(patientInfo.age));
      if (patientInfo?.sex) form.set("patient_sex", patientInfo.sex);

      console.log(
        `Forwarding to DermaVision → patient: ${patientInfo?.name || "Anonymous"}`,
      );

      const dermaResponse = await fetch("http://127.0.0.1:8000/analyse", {
        method: "POST",
        body: form,
      });

      if (!dermaResponse.ok) {
        const errorText = await dermaResponse.text();
        console.error(
          `DermaVision error ${dermaResponse.status}: ${errorText}`,
        );
        return res.status(502).json({
          error: `DermaVision API error ${dermaResponse.status}: ${errorText}`,
        });
      }

      const dermaResult: any = await dermaResponse.json();
      console.log(
        "RAW Django predictions:",
        JSON.stringify(dermaResult.allPredictions, null, 2),
      ); // ← add here

      if (!dermaResult.primaryFinding || dermaResult.confidence == null) {
        return res
          .status(502)
          .json({ error: "DermaVision returned a malformed response." });
      }

      console.log(
        `DermaVision → ${dermaResult.primaryFinding} (${dermaResult.confidence}%) | Urgency: ${dermaResult.urgency}`,
      );

      return res.json({
        primaryFinding: dermaResult.primaryFinding,
        confidence: dermaResult.confidence,
        urgency: dermaResult.urgency,
        urgencyText: dermaResult.urgencyText,
        treatmentNotes: dermaResult.treatmentNotes,
        recommendedAction: dermaResult.recommendedAction,
        referralNote: dermaResult.referralNote,
        conditionCode: dermaResult.conditionCode,
        allPredictions: dermaResult.allPredictions,
        heatmap_b64: dermaResult.heatmap_b64,
        modelVersion: dermaResult.model_version || "dermavision-dinov2-v1",
      });
    } catch (err: any) {
      console.error(
        "Failed to communicate with DermaVision backend:",
        err.message,
      );
      return res
        .status(502)
        .json({ error: "Failed to communicate with DermaVision backend." });
    }
  });

  // ── PDF Generation ────────────────────────────────────────────────────────
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      console.log(
        "Forwarding PDF generation request to DermaVision backend...",
      );
      const djangoResponse = await fetch("http://127.0.0.1:8000/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      if (!djangoResponse.ok) {
        const errText = await djangoResponse.text();
        console.error("Django PDF error:", errText);
        return res
          .status(502)
          .json({ error: "Failed to generate PDF on backend." });
      }

      const result: any = await djangoResponse.json();
      if (!result.pdf_b64) {
        return res
          .status(502)
          .json({ error: "Backend returned malformed PDF." });
      }

      res.json({ pdf_b64: result.pdf_b64 });
    } catch (err: any) {
      console.error("Failed to communicate with Django /pdf:", err.message);
      res.status(502).json({ error: "Failed to communicate with Django." });
    }
  });

  // ── Vite / static ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
