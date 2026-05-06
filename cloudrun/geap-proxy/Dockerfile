FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Cloud Run は PORT 環境変数でポートを指定する
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
