FROM python:3.11-slim AS builder
WORKDIR /build

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
# Install only production dependencies into an isolated venv
RUN uv venv /venv && \
    uv pip install --python /venv/bin/python \
        "fastapi>=0.115.0" \
        "uvicorn[standard]>=0.30.0" \
        "sqlalchemy>=2.0.0" \
        "alembic>=1.13.0" \
        "asyncpg>=0.29.0" \
        "pydantic>=2.7.0" \
        "pydantic-settings>=2.3.0" \
        "bcrypt>=4.1.0" \
        "python-multipart>=0.0.9" \
        "aiofiles>=23.2.0" \
        "itsdangerous>=2.2.0" \
        "slowapi>=0.1.9" \
        "httpx>=0.27.0" \
        "sentry-sdk[fastapi]>=2.0.0"

FROM python:3.11-slim AS runtime
WORKDIR /app

COPY --from=builder /venv /venv

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

ENV PATH="/venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips=*"]
