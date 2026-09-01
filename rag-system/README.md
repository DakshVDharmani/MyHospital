# MyHospital RAG

This service creates multilingual embeddings locally and stores vectors plus source metadata in Pinecone. At chat time it embeds the question locally, retrieves relevant website chunks, and supplies them to the existing Sarvam voice pipeline.

## Setup

1. Run `npm install` here with Node 18+.
2. Copy `.env.example` to `.env` and add a Pinecone API key.
3. Run `npm run index` after website behavior or documentation changes.
4. Run `npm start` (default: `http://localhost:8790`).
5. Set `RAG_SERVICE_URL=http://localhost:8790` in `backend/.env` and start the existing backend.

The first run downloads `Xenova/multilingual-e5-small`; later runs use the cached model. The indexer reads the project README, frontend source, safe backend route/config source, and `knowledge/`. It excludes environment files, databases, dependencies, builds, and patient data. Add concise explanations to `knowledge/` whenever product intent is not clear from code.
