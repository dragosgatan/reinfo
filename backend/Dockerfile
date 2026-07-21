FROM python:3.11-slim AS builder
WORKDIR /build

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
# Install production dependencies straight from pyproject.toml's [project.dependencies] -
# do not hardcode the package list here again, it silently drifts out of sync (see incident 2026-07-21).
RUN uv venv /venv && \
    uv pip install --python /venv/bin/python -r pyproject.toml

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
