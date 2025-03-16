FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Use gunicorn with 10-minute timeout
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "600", "app.main:create_app()"]