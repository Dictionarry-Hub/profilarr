from flask import Flask
from flask_cors import CORS
from app.routes import regex_routes, format_routes

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
    app.register_blueprint(regex_routes.bp)
    app.register_blueprint(format_routes.bp)
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0')
