import { config } from "./config.js";
import { embedQuery } from "./embed.js";
import { websiteIndex } from "./pinecone.js";
export async function retrieve(question, topK = config.topK) {
  const result = await websiteIndex().query({ vector: await embedQuery(question), topK, includeMetadata: true });
  return (result.matches || []).filter((match) => (match.score || 0) >= config.minScore).map((match) => ({ text: String(match.metadata?.text || ""), source: String(match.metadata?.source || "unknown"), score: match.score || 0 }));
}
export function formatContext(matches) { return matches.length ? matches.map((match, i) => `[${i + 1}] ${match.text}`).join("\n\n") : "No relevant website documentation was found."; }
