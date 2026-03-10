from PyPDF2 import PdfReader


CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def extract_text(file_path):
    reader = PdfReader(file_path)
    return "".join(page.extract_text() or "" for page in reader.pages)


def chunk_text(text):
    if not text:
        return []

    chunks = []
    step = CHUNK_SIZE - CHUNK_OVERLAP
    start = 0

    while start < len(text):
        chunk = text[start : start + CHUNK_SIZE]
        if chunk:
            chunks.append(chunk)
        start += step

    return chunks
