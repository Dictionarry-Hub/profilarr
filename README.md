# Profilarr

Profilarr is a Python-based tool designed to add import/export/sync functionality to the \*arr suite. It offers a user-friendly way to export existing custom formats / profiles, import new ones or sync a master instance of Radarr / Sonarr with extras.

## ⚠️ Before Continuing

- **This tool will overwrite any custom formats in your \*arr installation that have the same name.**
- **Custom Formats MUST be imported before syncing any premade profile.**
- **Always back up your Radarr and Sonarr configurations before using Profilarr to avoid unintended data loss.** (Seriously, do it. Even I've lost data to this tool because I forgot to back up my configs.)

## 🛠️ Installation

### Prerequisites

- Python 3.x installed. You can download it from [python.org](https://www.python.org/downloads/).
- Radarr / Sonarr

### 📦 Dependencies

- run `pip install -r requirements.txt` to install dependencies.

### Initial Setup

1. Download the latest Profilarr package from the release section.
2. Extract its contents into a folder.
3. Run `python setup.py` in your command line interface to generate a config file.
   - This will create a `config.yml` file in the same directory as `setup.py`.
4. Open the `config.yml` file in a text editor.
   - Add the URL and API key to the master instances of Radarr / Sonarr.
   - If syncing, add the URL, API key and a name to each extra instance of Radarr / Sonarr.
   - If exporting, adjust the `export_path` to your desired export location.
5. Save the changes.

## 🚀 Usage

### Importing

1. Run `python importarr.py` in your command line interface.
2. Follow the on-screen prompts to select the app and the data you want to import.
3. Choose the specific file for Custom Formats or select a profile for Quality Profiles.
4. The data will be imported to your selected Radarr or Sonarr installation.

#### Custom Format Import Example

```bash
PS Z:\Profilarr> py importarr.py
Available instances to import to:
1. Sonarr [Master]
2. Radarr [Master]
3. Sonarr [4k-sonarr]
4. Radarr [4k-radarr]
Enter the number of the instance to import to: 4


Choose what to import:
1. Custom Formats
2. Quality Profiles
Enter your choice (1/2): 1

Available files:
1. Custom Formats (Radarr).json
Select a file to import (or 'all' for all files): 1

Adding custom format 'D-Z0N3': SUCCESS
Adding custom format 'DON': SUCCESS
Adding custom format 'EbP': SUCCESS
Adding custom format 'Geek': SUCCESS
Adding custom format 'TayTo': SUCCESS
Adding custom format 'ZQ': SUCCESS
Adding custom format 'VietHD': SUCCESS
Adding custom format 'CtrlHD': SUCCESS
Adding custom format 'HiFi': SUCCESS
Adding custom format 'FoRM': SUCCESS
Adding custom format 'HiDt': SUCCESS
Adding custom format 'SA89': SUCCESS
...

Successfully added 0 custom formats, updated 131 custom formats.
```

#### Quality Profile Import Example

```bash
PS Z:\Profilarr> py importarr.py
Available instances to import to:
1. Sonarr [Master]
2. Radarr [Master]
3. Sonarr [4k-sonarr]
4. Radarr [4k-radarr]
Enter the number of the instance to import to: 4


Choose what to import:
1. Custom Formats
2. Quality Profiles
Enter your choice (1/2): 2

Available files:
1. 1080p Balanced (Radarr).json
2. 1080p Balanced (Single Grab) (Radarr).json
3. 1080p h265 Balanced (Radarr).json
4. 1080p h265 Balanced (Single Grab) (Radarr).json
5. 1080p Optimal (Radarr).json
6. 1080p Optimal (Single Grab) (Radarr).json
7. 1080p Transparent (Double Grab) (Radarr).json
8. 1080p Transparent (Radarr).json
9. 1080p Transparent (Single Grab) (Radarr).json
10. 2160p Optimal (Radarr).json
11. 2160p Optimal (Single Grab) (Radarr).json
Select a file to import (or 'all' for all files): all

Successfully added Quality Profile 1080p Balanced
Successfully added Quality Profile 1080p Balanced (Single Grab)
Successfully added Quality Profile 1080p h265 Balanced
Successfully added Quality Profile 1080p h265 Balanced (Single Grab)
Successfully added Quality Profile 1080p Optimal
Successfully added Quality Profile 1080p Optimal (Single Grab)
Successfully added Quality Profile 1080p Transparent (Double Grab)
Successfully added Quality Profile 1080p Transparent
Successfully added Quality Profile 1080p Transparent (Single Grab)
Successfully added Quality Profile 2160p Optimal
Successfully added Quality Profile 2160p Optimal (Single Grab)
PS Z:\Profilarr>
```

### Exporting

1. Run `python exportarr.py` in your command line interface.
2. Choose the instance you want to export from.
3. Choose the data you want to export.
4. The data will be exported to `exports/{instance_type}/{instance_name}/{data_type}`.

#### Example

```bash
PS Z:\Profilarr> py exportarr.py
Available sources to export from:
1. Sonarr [Master]
2. Radarr [Master]
3. Sonarr [4k-sonarr]
4. Radarr [4k-radarr]
Enter the number of the app to export from: 2

Choose what to export:
1. Custom Formats
2. Quality Profiles
3. Both
Enter your choice (1/2/3): 3

Attempting to access Radarr at http://localhost:7878
Found 131 custom formats.
 - D-Z0N3
 - DON
 - EbP
 - Geek
 - TayTo
 - ZQ
 - VietHD
 - CtrlHD
 - HiFi
 - FoRM
... and 121 more.
Saved to './exports\radarr\master\custom_formats\Custom Formats (Radarr).json'

Attempting to access Radarr at http://localhost:7878
Found 13 quality profiles.
 - 1080p Optimal
 - 2160p Optimal
 - 1080p Balanced
 - 1080p Transparent
 - 1080p Transparent (Double Grab)
 - 1080p Transparent (Single Grab)
 - 1080p Balanced (Single Grab)
 - 1080p h265 Balanced
 - 1080p h265 Balanced (Single Grab)
 - 1080p x265 HDR Transparent
... and 3 more.
Saved to 'exports\radarr\master\profiles'

PS Z:\Profilarr>
```

### Syncing

1. Run `python syncarr.py` in your command line interface.
2. The script will automatically export data from the master instance and import it to all other instances specified in `config.json`.
3. This feature is designed to manage multiple Radarr/Sonarr instances, syncing profiles and formats seamlessly.

#### Example

```bash
PS Z:\Profilarr> py syncarr.py
Select the app you want to sync:
1. Radarr
2. Sonarr
Enter your choice (1 or 2): 2
Attempting to access Sonarr at http://localhost:8989
Found 135 custom formats.
 - D-Z0N3
 - DON
 - EbP
 - Geek
 - TayTo
 - ZQ
 - VietHD
 - CtrlHD
 - HiFi
 - FoRM
... and 125 more.
Saved to './temp_directory/custom_formats\Custom Formats (Sonarr).json'

Attempting to access Sonarr at http://localhost:8989
Found 11 quality profiles.
 - 1080p Transparent
 - 2160p Optimal
 - 1080p Transparent (Single Grab)
 - 1080p Transparent (Double Grab)
 - 1080p Balanced
 - 1080p Balanced (Single Grab)
 - 1080p h265 Balanced
 - 1080p h265 Balanced (Single Grab)
 - 1080p Optimal
 - 1080p Optimal (Single Grab)
... and 1 more.
Saved to 'temp_directory\quality_profiles'

Importing to instance: 4k-sonarr
Adding custom format 'D-Z0N3': SUCCESS
Adding custom format 'DON': SUCCESS
Adding custom format 'EbP': SUCCESS
Adding custom format 'Geek': SUCCESS
Adding custom format 'TayTo': SUCCESS
Adding custom format 'ZQ': SUCCESS
Adding custom format 'VietHD': SUCCESS
Adding custom format 'CtrlHD': SUCCESS
Adding custom format 'HiFi': SUCCESS
... and 125 more.

Successfully added 135 custom formats, updated 0 custom formats.
Successfully added Quality Profile 1080p Balanced (Single Grab)
Successfully added Quality Profile 1080p Balanced
Successfully added Quality Profile 1080p h265 Balanced
Successfully added Quality Profile 1080p h265 Balanced (Single Grab)
Successfully added Quality Profile 1080p Optimal (Single Grab)
Successfully added Quality Profile 1080p Optimal
Successfully added Quality Profile 1080p Transparent (Double Grab)
Successfully added Quality Profile 1080p Transparent (Single Grab)
Successfully added Quality Profile 1080p Transparent
Successfully added Quality Profile 2160p Optimal (Single Grab)
Successfully added Quality Profile 2160p Optimal
Deleted temporary directory: ./temp_directory
PS Z:\Profilarr>
```

### Radarr and Sonarr Compatibility

- You are only able to import / sync files to the app that is included in the file name (e.g. `Radarr` or `Sonarr`).
- It is possible to manually rename the files to import them to the other app, but this is not recommended.
  - Custom Formats will succesfully import, but will require manual editing to work with the other app, i.e. you must adjust the quality sources to match the other app's naming scheme.
  - Quality Profiles will not import at all, as they are not compatible with the other app. It is possible to import them manually by editing the json directly, but this is not recommended.
  - In future, I may add a feature to automatically convert profiles between the two apps, but this is not currently a priority.

## 🌟 Upcoming Features

- **Lidarr Support:** Expand functionality to include Lidarr, allowing users to manage music quality profiles and custom formats.
- **User Interface (UI):** Development of a graphical user interface (GUI) for easier and more intuitive interaction with Profilarr. This UI will cater to users who prefer graphical over command-line interactions.
- **Automatic Updates:** Implement an auto-update mechanism for Profilarr, ensuring users always have access to the latest features, improvements, and bug fixes without manual intervention.

# TRaSH Guides

Some custom formats found here have been interated on from the trash guides. Credit for these goes entirely to trash, and can be found on their site here. It is not my intention to steal their work, but rather to build on it and make it more accessible to the average user through my quality profiles. Please check out their site for more information on their work.

https://trash-guides.info/
