import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export const config = {
  projectRoot: path.resolve(here, "../.."), pineconeApiKey: process.env.PINECONE_API_KEY || "",
  indexName: process.env.PINECONE_INDEX || "myhospital-website", cloud: process.env.PINECONE_CLOUD || "aws",
  region: process.env.PINECONE_REGION || "us-east-1", namespace: process.env.PINECONE_NAMESPACE || "website-v1",
  embeddingModel: process.env.EMBEDDING_MODEL || "Xenova/multilingual-e5-small", dimension: 384,
  port: Number(process.env.RAG_PORT || 8790), topK: Number(process.env.RAG_TOP_K || 6),
  minScore: Number(process.env.RAG_MIN_SCORE || 0.35),
};
export function requirePineconeKey() {
  if (!config.pineconeApiKey) throw new Error("PINECONE_API_KEY is missing. Copy .env.example to .env and add a Pinecone key.");
}
