import { pipeline } from "@huggingface/transformers";
import { config } from "./config.js";
let extractorPromise;
async function extractor() {
  // Quantized ONNX keeps local CPU/RAM usage practical while preserving
  // enough semantic quality for website-help retrieval.
  extractorPromise ||= pipeline("feature-extraction", config.embeddingModel, { dtype: "q8" });
  return extractorPromise;
}
async function embed(text, prefix) {
  const model = await extractor();
  const output = await model(`${prefix}: ${text}`, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
export const embedDocument = (text) => embed(text, "passage");
export const embedQuery = (text) => embed(text, "query");

export async function embedDocuments(texts) {
  const model = await extractor();
  const output = await model(texts.map((text) => `passage: ${text}`), {
    pooling: "mean",
    normalize: true,
  });
  return output.tolist();
}
