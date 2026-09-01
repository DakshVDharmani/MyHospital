import { Pinecone } from "@pinecone-database/pinecone";
import { config, requirePineconeKey } from "./config.js";
let client;
export function pinecone() { requirePineconeKey(); client ||= new Pinecone({ apiKey: config.pineconeApiKey }); return client; }
export async function ensureIndex() {
  const pc = pinecone();
  const existing = await pc.listIndexes();
  if (!existing.indexes?.some((item) => item.name === config.indexName)) {
    await pc.createIndex({ name: config.indexName, dimension: config.dimension, metric: "cosine",
      spec: { serverless: { cloud: config.cloud, region: config.region } }, waitUntilReady: true });
  }
  return pc.index(config.indexName).namespace(config.namespace);
}
export function websiteIndex() { return pinecone().index(config.indexName).namespace(config.namespace); }
