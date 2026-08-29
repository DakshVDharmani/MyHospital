# Builds only service/ + the trained weights — no dataset, no training code.
# database/ and src/ are never copied in, so deleting them from the repo
# later has no effect on this image.
FROM python:3.11-slim

WORKDIR /app

COPY service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY service/ ./service/
COPY weights/model.joblib ./weights/model.joblib

EXPOSE 8000
# Railway injects $PORT at runtime and expects the app to bind to it — shell
# form so that expansion actually happens (the exec-form CMD above would pass
# the literal string "$PORT" through).
CMD uvicorn service.main:app --host 0.0.0.0 --port ${PORT:-8000}
