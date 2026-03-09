# AI Doc Search

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FAISS](https://img.shields.io/badge/FAISS-1F2937?style=for-the-badge)
![SentenceTransformers](https://img.shields.io/badge/SentenceTransformers-0F172A?style=for-the-badge)
![Groq](https://img.shields.io/badge/Groq-111111?style=for-the-badge)

Local RAG app for uploading PDFs, indexing them with sentence-transformer embeddings, retrieving relevant chunks with FAISS, and answering questions with Groq.

## Demo

![Demo GIF placeholder](./docs/demo.gif)

Replace `./docs/demo.gif` with your actual demo recording.

## Architecture

This project follows a standard retrieval-augmented generation flow:

```text
PDF
 |
 v
Extract Text
 |
 v
Chunks
 |
 v
Embeddings
 |
 v
FAISS Index

User Query
 |
 v
Embed Query
 |
 v
Retrieve Top Chunks
 |
 v
Groq LLM
 |
 v
Answer
```

Requested high-level pipeline:

```text
PDF -> chunks -> embeddings -> FAISS index -> query -> retrieve -> Groq LLM -> answer
```

## RAG Flow

1. A PDF is uploaded to the FastAPI backend.
2. `backend/pdf_processor.py` extracts raw text with `PyPDF2`.
3. The text is split into overlapping chunks with `RecursiveCharacterTextSplitter`.
4. `backend/vector_store.py` embeds each chunk with `all-MiniLM-L6-v2`.
5. The embeddings are stored in a FAISS index, one index per uploaded document.
6. A user question is embedded and matched against one document or across all documents.
7. The top chunks are sent to Groq with a strict context-only prompt.
8. The model returns an answer plus the retrieved source chunks.

## Project Structure

```text
backend/
  Dockerfile
  main.py
  pdf_processor.py
  rag.py
  vector_store.py
frontend/
  src/
    App.jsx
  vercel.json
```

## Setup

### Backend

1. Create and activate a Python 3.12 virtual environment.
2. Install dependencies:

```bash
pip install fastapi "uvicorn[standard]" python-multipart pypdf2 langchain-text-splitters faiss-cpu sentence-transformers numpy requests
```

3. Set your Groq API key:

```bash
export GROQ_API_KEY=your_key_here
```

On Windows PowerShell:

```powershell
$env:GROQ_API_KEY="your_key_here"
```

4. Start the API from the `backend` directory:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

1. Create or use your Vite React frontend scaffold inside `frontend/`.
2. Install frontend dependencies:

```bash
npm install
```

3. Start the frontend dev server:

```bash
npm run dev
```

The frontend expects the backend at `http://localhost:8000` and is allowed by CORS from `http://localhost:5173`.

## Docker

Build and run the backend container:

```bash
docker build -t ai-doc-search-backend ./backend
docker run -p 8000:8000 -e GROQ_API_KEY=your_key_here ai-doc-search-backend
```

## Deployment Notes

- Backend: containerized with Docker for FastAPI deployment.
- Frontend: `frontend/vercel.json` is set up for a Vite-based Vercel deployment.
- Multi-document search is stored in memory for the active backend process, while FAISS indices are persisted under `/tmp/vector_stores`.

## Tech Stack

- FastAPI
- React
- PyPDF2
- LangChain text splitters
- Sentence Transformers
- FAISS
- Groq API

## API Summary

- `POST /upload`
  Accepts a PDF, extracts text, chunks it, builds a FAISS index, and stores it by filename.

- `POST /ask`
  Accepts a `question` and optional `document`. If `document` is omitted, retrieval runs across all uploaded documents.
