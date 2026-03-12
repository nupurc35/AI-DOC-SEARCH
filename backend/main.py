from PyPDF2 import PdfReader
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from rank_bm25 import BM25Okapi


load_dotenv()

MODEL_NAME = "llama-3.3-70b-versatile"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://ai-doc-search-lyart.vercel.app",
        "https://ai-doc-search-git-main-nupur435das-6544s-projects.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOCUMENT_STORE = {
    "chunks": [],
    "bm25": None,
}


def extract_pdf_text(file_object):
    reader = PdfReader(file_object)
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages).strip()


def chunk_text(text):
    chunks = []
    chunk_size = 500
    overlap = 50
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


def build_bm25(chunks):
    tokenized_chunks = []
    for chunk in chunks:
        tokenized_chunks.append(chunk.split())
    return BM25Okapi(tokenized_chunks)


def get_top_chunks(question):
    bm25 = DOCUMENT_STORE["bm25"]
    chunks = DOCUMENT_STORE["chunks"]

    if not bm25 or not chunks:
        raise HTTPException(status_code=400, detail="No document is loaded. Upload a PDF first.")

    query_tokens = question.split()
    return bm25.get_top_n(query_tokens, chunks, n=4)


def generate_answer(question, top_chunks):
    context = "\n\n".join(top_chunks)
    prompt = (
        "Answer using ONLY the context below. "
        "If not found say I could not find this in the document. "
        f"Context: {context}. "
        f"Question: {question}"
    )

    client = Groq()
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    await file.seek(0)
    text = extract_pdf_text(file.file)
    chunks = chunk_text(text)

    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found in the PDF.")

    DOCUMENT_STORE["chunks"] = chunks
    DOCUMENT_STORE["bm25"] = build_bm25(chunks)

    return {"status": "ready", "chunks": len(chunks)}


@app.post("/ask")
async def ask_question(payload: dict):
    question = (payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    top_chunks = get_top_chunks(question)
    answer = generate_answer(question, top_chunks)

    return {"answer": answer, "sources": top_chunks}

import os
import uvicorn

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))


