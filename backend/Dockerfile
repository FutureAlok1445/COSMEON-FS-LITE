FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
# We copy to /app/backend to maintain the Python module path (backend.main)
COPY . ./backend/

# Default command (will be overridden in docker-compose for specific roles if needed)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
