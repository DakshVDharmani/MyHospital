import { config } from "./config.js";
import { loadWebsiteDocuments } from "./content.js";
import { embedDocuments } from "./embed.js";
import { ensureIndex } from "./pinecone.js";
const documents = await loadWebsiteDocuments(); const index = await ensureIndex();
const startOffset = Math.max(0, Number(process.argv[2] || 0));
for (let offset = startOffset; offset < documents.length; offset += 50) {
  const batch = documents.slice(offset, offset + 50); const records = [];
  const vectors = await embedDocuments(batch.map((document) => document.content));
  batch.forEach((document, index) => records.push({ id: document.id, values: vectors[index], metadata: { text: document.content, source: document.source, chunk: document.chunk } }));
  await index.upsert(records); console.log(`Indexed ${Math.min(offset + batch.length, documents.length)}/${documents.length}`);
}
console.log(`Website knowledge is ready in ${config.indexName}/${config.namespace}.`);
