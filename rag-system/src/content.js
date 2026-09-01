import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
const roots = ["README.md", "frontend/src", "backend/routes", "backend/config.js", "rag-system/knowledge"];
const extensions = new Set([".md", ".tsx", ".ts", ".jsx", ".js", ".css"]);
const ignored = new Set(["node_modules", "dist", ".git"]);
async function walk(relativePath) {
  const absolute = path.join(config.projectRoot, relativePath); const stat = await fs.stat(absolute);
  if (stat.isFile()) return extensions.has(path.extname(absolute)) ? [absolute] : [];
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  return (await Promise.all(entries.filter((entry) => !ignored.has(entry.name)).map((entry) => walk(path.join(relativePath, entry.name))))).flat();
}
function chunks(text, maxChars = 2200, overlap = 250) {
  const result = []; let current = "";
  for (const paragraph of text.replace(/\r/g, "").split(/\n{2,}/)) {
    if (current && current.length + paragraph.length > maxChars) { result.push(current.trim()); current = `${current.slice(-overlap)}\n\n${paragraph}`; }
    else current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current.trim()) result.push(current.trim()); return result;
}
export async function loadWebsiteDocuments() {
  const files = (await Promise.all(roots.map(walk))).flat(); const documents = [];
  for (const absolute of files) {
    const source = path.relative(config.projectRoot, absolute).replaceAll("\\", "/"); const text = await fs.readFile(absolute, "utf8");
    chunks(text).forEach((content, chunk) => { const id = crypto.createHash("sha256").update(`${source}:${chunk}:${content}`).digest("hex"); documents.push({ id, content: `Source: ${source}\n${content}`, source, chunk }); });
  }
  return documents;
}
