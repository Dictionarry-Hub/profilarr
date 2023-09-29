# Profilarr

Profilarr is a Python-based tool that enables seamless synchronization of custom formats and quality profiles in Radarr / Sonarr. It's designed to aid users in sharing / importing custom formats / quality profiles seamlessly. 

## ⚠️ Before Continuing

- **This tool will overwrite any custom formats in your Radarr installation that have the same name.**
- **Custom Formats MUST be imported before syncing a profile.**

## 🛠️ Installation

### Prerequisites

- Python 3.x installed. You can download it from [python.org](https://www.python.org/downloads/).

### Steps

1. Download the Profilarr zip file from the release section.
2. Extract its contents into a folder.
3. Open `import.py` in a text editor of your choice.
   - Add your Radarr API key to the designated section.
   - Modify the Base URL if needed
4. Save the changes and close the text editor.

## 🚀 Usage

1. Open a terminal or command prompt.
2. Navigate to the directory where you extracted Profilarr.
3. Run the command `python import_cf.py` to import the necessary custom formats.
4. Run the command `python import_qf.py` and follow the prompts to choose and import your desired profile.

## 📦 Dependencies

- `requests` (Install using `pip install requests`)

## ⚙️ Configuration

### Radarr API Key and Base URL

- Your Radarr API Key and Base URL can be configured in the `import.py` file.
- The Base URL should be in the format `http://localhost:7878` unless you have a different host or port.
