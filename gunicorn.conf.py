import os

# Make host and port configurable
host  = os.getenv("HOST", "0.0.0.0")
port  = os.getenv("PORT", "6868")
bind  = f"{host}:{port}"
