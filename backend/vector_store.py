from pathlib import Path
import pickle

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


class VectorStore:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.index = None
        self.chunks = []

    def build(self, chunks):
        self.chunks = list(chunks)
        if not self.chunks:
            self.index = None
            return

        embeddings = self.model.encode(
            self.chunks,
            convert_to_numpy=True,
            normalize_embeddings=True,
        ).astype(np.float32)

        self.index = faiss.IndexFlatIP(embeddings.shape[1])
        self.index.add(embeddings)

    def search(self, query, top_k=4):
        return [chunk for chunk, _score in self.search_with_scores(query, top_k=top_k)]

    def search_with_scores(self, query, top_k=4):
        if self.index is None or not self.chunks:
            return []

        query_embedding = self.model.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        ).astype(np.float32)

        k = min(top_k, len(self.chunks))
        scores, indices = self.index.search(query_embedding, k)
        return [
            (self.chunks[i], float(score))
            for score, i in zip(scores[0], indices[0])
            if i != -1
        ]

    def save(self, path):
        if self.index is None:
            raise ValueError("Cannot save an empty vector store. Build or load an index first.")

        target_dir = Path(path)
        target_dir.mkdir(parents=True, exist_ok=True)

        faiss.write_index(self.index, str(target_dir / "index.faiss"))
        with open(target_dir / "store.pkl", "wb") as file:
            pickle.dump(
                {
                    "model_name": self.model_name,
                    "chunks": self.chunks,
                },
                file,
            )

    @classmethod
    def load(cls, path):
        target_dir = Path(path)

        with open(target_dir / "store.pkl", "rb") as file:
            data = pickle.load(file)

        store = cls(model_name=data["model_name"])
        store.chunks = data["chunks"]
        store.index = faiss.read_index(str(target_dir / "index.faiss"))
        return store
