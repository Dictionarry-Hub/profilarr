from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import yaml

app = Flask(__name__)
CORS(app)

REGEX_DIR = 'regex_patterns'
FORMAT_DIR = 'custom_formats'

os.makedirs(REGEX_DIR, exist_ok=True)
os.makedirs(FORMAT_DIR, exist_ok=True)

def get_next_regex_id():
    regex_files = [f for f in os.listdir(REGEX_DIR) if f.endswith('.yml')]
    if not regex_files:
        return 1
    max_id = max(int(f.split('.')[0]) for f in regex_files)
    return max_id + 1

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/save_regex', methods=['POST'])
def save_regex():
    data = request.json
    if 'id' not in data or data['id'] == 0:
        data['id'] = get_next_regex_id()
    filename = f"{REGEX_DIR}/{data['id']}.yml"
    with open(filename, 'w') as file:
        yaml.dump(data, file)
    return jsonify({"message": f"Regex saved to {filename}"}), 200

@app.route('/save_format', methods=['POST'])
def save_format():
    data = request.json
    if 'id' not in data:
        return jsonify({"error": "Missing 'id' in request data"}), 400
    filename = f"{FORMAT_DIR}/{data['id']}.yml"
    with open(filename, 'w') as file:
        yaml.dump(data, file)
    return jsonify({"message": f"Format saved to {filename}"}), 200

@app.route('/get_regexes', methods=['GET'])
def get_regexes():
    regexes = []
    for filename in os.listdir(REGEX_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(REGEX_DIR, filename), 'r') as file:
                regex = yaml.safe_load(file)
                regexes.append(regex)
    return jsonify(regexes), 200

@app.route('/get_formats', methods=['GET'])
def get_formats():
    formats = []
    for filename in os.listdir(FORMAT_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(FORMAT_DIR, filename), 'r') as file:
                format_data = yaml.safe_load(file)
                formats.append(format_data)
    return jsonify(formats), 200

@app.route('/delete_regex/<int:id>', methods=['DELETE'])
def delete_regex(id):
    filename = f"{REGEX_DIR}/{id}.yml"
    if os.path.exists(filename):
        os.remove(filename)
        return jsonify({"message": f"Regex with ID {id} deleted."}), 200
    else:
        return jsonify({"error": f"Regex with ID {id} not found."}), 404

@app.route('/delete_format/<int:id>', methods=['DELETE'])
def delete_format(id):
    filename = f"{FORMAT_DIR}/{id}.yml"
    if os.path.exists(filename):
        os.remove(filename)
        return jsonify({"message": f"Format with ID {id} deleted."}), 200
    else:
        return jsonify({"error": f"Format with ID {id} not found."}), 404

if __name__ == '__main__':
    app.run(debug=True)
