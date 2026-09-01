import http from "node:http";
import { config } from "./config.js";
import { formatContext, retrieve } from "./retrieve.js";
function json(res, status, body) { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); }
const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, index: config.indexName, namespace: config.namespace });
  if (req.method !== "POST" || req.url !== "/retrieve") return json(res, 404, { error: "Not found" });
  try {
    let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error("Request is too large"); }
    const { question, topK } = JSON.parse(raw || "{}"); if (!question?.trim()) return json(res, 400, { error: "question is required" });
    const matches = await retrieve(question.trim(), topK); return json(res, 200, { context: formatContext(matches), matches });
  } catch (error) { console.error("Retrieval error:", error.message); return json(res, 500, { error: error.message }); }
});
server.listen(config.port, () => console.log(`MyHospital RAG listening on http://localhost:${config.port}`));
