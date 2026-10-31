# Railway / Docker entry from the monorepo root.
# Build context = repository root (Root Directory = /).
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/data/hf \
    TRANSFORMERS_CACHE=/data/hf \
    SENTENCE_TRANSFORMERS_HOME=/data/hf \
    MSRAG_UPLOAD_DIR=/data/uploads

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/hf /data/uploads

COPY backend/requirements.txt .
RUN pip install --upgrade pip \
 && pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install -r requirements.txt

COPY backend/app ./app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
