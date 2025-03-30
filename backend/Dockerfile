FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Use gunicorn with 10-minute timeout
CMD ["python", "-m", "app.main"]