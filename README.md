# Profilarr

Profilarr is a Python-based tool designed to add import / export functionality to the \*arr suite. It offers a user-friendly way to export and import custom formats and quality profiles between Radarr and Sonarr installations.

## ⚠️ Before Continuing

- **This tool will overwrite any custom formats in your \*arr installation that have the same name.**
- **Custom Formats MUST be imported before syncing any premade profile.**
- **Always back up your Radarr and Sonarr configurations before using Profilarr to avoid unintended data loss.** (Seriously, do it. Even I've lost data to this tool because I forgot to back up my configs.)

## 🛠️ Installation

### Prerequisites

- Python 3.x installed. You can download it from [python.org](https://www.python.org/downloads/).
- Radarr / Sonarr

### 📦 Dependencies

- `requests` (Install using `pip install requests`)

### Initial Setup

1. Download the Profilarr package from the release section.
2. Extract its contents into a folder.
3. Open the `config.json` file in a text editor.
   - Add your Radarr / Sonarr API key and modify the base URL as necessary.
   - If importing / exporting, only change the master installation's API key and base URL.
   - If syncing, add the API keys and base URLs of all instances you want to sync.
   - The master install will be the one that all other instances sync to.
   - Sync coming soon (so don't worry about it for now)
4. Save the changes.

## 🚀 Usage

### Exporting

1. Run `python export.py` in your command line interface.
2. Follow the on-screen prompts to select the app (Radarr or Sonarr) and the data (Custom Formats or Quality Profiles) you want to export.
3. Exported data will be saved in respective directories within the tool's folder.

### Importing

1. Run `python import.py` in your command line interface.
2. Follow the on-screen prompts to select the app and the data you want to import.
3. Choose the specific file for Custom Formats or select a profile for Quality Profiles.
4. The data will be imported to your selected Radarr or Sonarr installation.

### Radarr and Sonarr Compatibility

- Custom formats can be imported and exported between Radarr and Sonarr.
- Quality profiles are not directly interchangeable between Radarr and Sonarr due to differences in quality source names. To work around this, export a profile from one application, modify it as needed, and then import it into the other application. Further adjustments can then be made within the app.

## 🌟 Upcoming Features

- **Lidarr Support:** Expand functionality to include Lidarr, allowing users to manage music quality profiles and custom formats.

- **Syncing Multiple Instances:** Simplify the management of multiple Radarr/Sonarr instances. This feature aims to enable seamless syncing of profiles and formats across different installations.

- **User Interface (UI):** Development of a graphical user interface (GUI) for easier and more intuitive interaction with Profilarr. This UI will cater to users who prefer graphical over command-line interactions.

- **Automatic Updates:** Implement an auto-update mechanism for Profilarr, ensuring users always have access to the latest features, improvements, and bug fixes without manual intervention.
