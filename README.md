# Profilarr

Profilarr is a Python-based tool that enables synchronization of custom formats and quality profiles in Radarr / Sonarr. It's designed to aid users in exporting / importing custom formats & quality profiles seamlessly.

Companion tool to Dictionarry to mass import custom formats / profiles quickly.

## ⚠️ Before Continuing

- **This tool will overwrite any custom formats in your \*arr installation that have the same name.**
- **Custom Formats MUST be imported before syncing any premade profile.**

## 🛠️ Installation

### Prerequisites

- Python 3.x installed. You can download it from [python.org](https://www.python.org/downloads/).
- Radarr / Sonarr

### Steps

1. Download the Profilarr zip file from the release section.
2. Extract its contents into a folder.
3. Open either of the `import.py` files in a text editor of your choice.
   - Add your Radarr / Sonarr API key to the designated section.
   - Modify the Base URL if needed
4. Save the changes and close the text editor.

## 🚀 Usage

1. Open a terminal or command prompt.
2. Navigate to the directory where you extracted Profilarr.
3. Run the command `python import_custom_formats.py` to import the necessary custom formats.
4. Run the command `python import_quality_profiles.py` and follow the prompts to choose and import your desired profile.

## 📦 Dependencies

- `requests` (Install using `pip install requests`)

## ⚙️ Configuration

### API Key and Base URL

- Your API Keys and Base URL can be configured in the `import.py` file.
- The Base URL should be in the format `http://localhost:7878 / 8989` unless you have a different host or port.

### Radarr into Sonarr

- Custom formats can be freely imported and exported from sonarr to radarr.
- Profiles cannot be imported from radarr to sonarr or vice versa. This is because some of the quality source names are different in each program. To get around this issue, export an already made profile from radarr / sonarr, replace the quality items from said profile into your profile of choice and then import it. You can then adjust the quality sources inside the app as you desire.
