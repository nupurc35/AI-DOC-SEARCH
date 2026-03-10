import os

import requests


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def answer_question(question, context_chunks):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set.")

    joined_chunks = "\n\n".join(context_chunks)
    prompt = (
        "Answer the question using ONLY the context below. "
        "If the answer is not in the context, say 'I could not find this in the document'. "
        f"Context: {joined_chunks}. "
        f"Question: {question}"
    )

    response = requests.post(
        GROQ_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        },
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    answer = data["choices"][0]["message"]["content"].strip()
    return answer, context_chunks
