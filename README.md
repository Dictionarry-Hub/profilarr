# Profilarr

Profilarr is a Python-based tool designed to add import/export/sync functionality to the \*arr suite. It offers a user-friendly way to export existing custom formats / profiles, import new ones or sync a master instance of Radarr / Sonarr with extras.

## ⚠️ Before Continuing

- **This tool will overwrite any custom formats in your \*arr installation that have the same name.**
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
   - If syncing, add the URL, API key, and a name to each extra instance of Radarr / Sonarr.
   - If exporting, adjust the `export_path` to your desired export location.
   - If importing non-Dictionary files, adjust the `import_path` to your desired import location.
5. Configure ANSI Color Support (Optional):
   - The Profilarr scripts use ANSI colors in terminal output for better readability. By default, this feature is enabled (`ansi_colors: true`).
   - **If your terminal does not properly display ANSI colors** (e.g., you see codes like `←[94m` instead of colored text), you may want to disable this feature to improve readability.
   - To disable ANSI colors, find the `settings` section in your `config.yml` file and change `ansi_colors` to `false`.
   ```yaml
   settings:
     export_path: "./exports"
     import_path: "./imports"
     ansi_colors: false # Disable ANSI colors if your terminal doesn't support them
   ```
6. Save the changes to your `config.yml` file after making the necessary adjustments.

## 🚀 Usage

- If using Windows, use `python <script>` or `py <script>`. If on Linux, use `python3 <script>`.

### Importing

Note: For users who start using Profilarr before v0.3, you no longer need to manually import custom formats. They will be imported automatically. Quality Profiles still require manual selection.

1. If importing Dictionarry files, make sure the import path is `./imports` (This is the default path).
2. If importing non Dictionarry files, make sure the import path is set to your desired import location.
3. Run `python importarr.py` in your command line interface.
4. Follow the on-screen prompts to select your desired app and which instance(s) to import to.
5. Choose your desired quality profile(s) to import.

#### Example: Importing 1080p Transparent and 2160p Optimal Quality Profiles

```
Select your app of choice
1. Radarr
2. Sonarr
Enter your choice:
1
Select your Radarr instance
1. Radarr (Master)
2. Radarr (4k-radarr)
Choose an instance by number, multiple numbers separated by commas or type 'all' for all instances:
2

Importing custom formats to Radarr : 4k-radarr

Adding custom format 'D-Z0N3' : SUCCESS
Adding custom format 'DON' : SUCCESS
Adding custom format 'EbP' : SUCCESS
Adding custom format 'Geek' : SUCCESS
Adding custom format 'TayTo' : SUCCESS
... and 129 more.

Successfully added 0 custom formats, updated 134 custom formats.

Available profiles:
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

Enter the numbers of the profiles you want to import separated by commas, or type 'all' to import all profiles:
8,10
Importing Quality Profiles to Radarr : 4k-radarr

Adding '1080p Transparent' quality profile : SUCCESS
Adding '2160p Optimal' quality profile : SUCCESS
```

### Exporting

1. Make sure the export path is set to your desired export location. The default is `./exports`.
2. Run `python exportarr.py` in your command line interface.
3. Follow the on-screen prompts to select your desired app and which instance(s) to export from.
4. Choose the data you want to export.
5. The data will be exported to `exports/{data_type}/{app}/`.

#### Example

```bash
Select your app of choice
1. Radarr
2. Sonarr
Enter your choice:
1
Select your Radarr instance
1. Radarr (Master)
2. Radarr (4k-radarr)
Choose an instance by number, multiple numbers separated by commas or type 'all' for all instances:
2

Exporting Custom Formats for Radarr : 4k-radarr
Exported 134 custom formats to ./exports/custom_formats/Radarr for 4k-radarr

Exporting Quality Profiles for Radarr : 4k-radarr...
Exported 2 quality profiles to ./exports/quality_profiles/Radarr for 4k-radarr
```

### Syncing

1. Make sure the import path is set to whatever your export path is. This is important, as the script will look for the exported files in this location.
1. Run `python syncarr.py` in your command line interface.
1. The script will automatically export data from the master instance and import it to all other instances specified in `config.json`.

#### Example

```bash
PS Z:\Profilarr> py syncarr.py
Select your app of choice
1. Radarr
2. Sonarr
Enter your choice:
1
Exporting Custom Formats for radarr : Master
Exported 134 custom formats to ./exports\custom_formats\radarr for Master

Exporting Quality Profiles for radarr : Master...
Exported 14 quality profiles to ./exports\quality_profiles\radarr for Master

Importing custom formats to radarr : 4k-radarr

...
Updating custom format 'Blu-Ray (Remux)' : SUCCESS
Updating custom format 'MAX' : SUCCESS
Updating custom format 'h265 (4k)' : SUCCESS
Updating custom format 'TEST FLAC' : SUCCESS

Successfully added 134 custom formats, updated 0 custom formats.

Available profiles:
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

Enter the numbers of the profiles you want to import separated by commas, or type 'all' to import all profiles:
all
Importing Quality Profiles to radarr : 4k-radarr

Adding '1080p Balanced' quality profile : SUCCESS
Adding '1080p Balanced (Single Grab)' quality profile : SUCCESS
Adding '1080p h265 Balanced' quality profile : SUCCESS
Adding '1080p h265 Balanced (Single Grab)' quality profile : SUCCESS
Adding '1080p Optimal' quality profile : SUCCESS
Adding '1080p Optimal (Single Grab)' quality profile : SUCCESS
Adding '1080p Transparent (Double Grab)' quality profile : SUCCESS
Updating '1080p Transparent' quality profile : SUCCESS
Adding '1080p Transparent (Single Grab)' quality profile : SUCCESS
Updating '2160p Optimal' quality profile : SUCCESS
Adding '2160p Optimal (Single Grab)' quality profile : SUCCESS
```

### Deleting

1. Run `python deletarr.py` in your command line interface.
2. Select the instance(s) from which you wish to delete data.
3. Choose between deleting Custom Formats, Quality Profiles or both
4. Select specific items by typing their numbers separated by commas, or type 'all' to delete everything.

#### Example

```plaintext
Select your app of choice
1. Radarr
2. Sonarr
Enter your choice:
1
Select your Radarr instance
1. Radarr (Master)
2. Radarr (4k-radarr)
Choose an instance by number, multiple numbers separated by commas or type 'all' for all instances:
2

Please select what you want to delete:
1. Custom Formats
2. Quality Profiles
3. Both
Enter your choice: 3
Available items to delete:
1. D-Z0N3
2. DON
3. EbP
4. Geek
5. TayTo
6. ZQ
...

Enter the number(s) of the items you wish to delete, separated by commas, or type 'all' for all:
Your choice: all
Deleting Custom Format (D-Z0N3) : SUCCESS
Deleting Custom Format (DON) : SUCCESS
Deleting Custom Format (EbP) : SUCCESS
Deleting Custom Format (Geek) : SUCCESS
Deleting Custom Format (TayTo) : SUCCESS
Deleting Custom Format (ZQ) : SUCCESS

Available items to delete:
1. 1080p Transparent
2. 2160p Optimal
3. 1080p Balanced
4. 1080p Balanced (Single Grab)
5. 1080p h265 Balanced
6. 1080p h265 Balanced (Single Grab)
7. 1080p Optimal
8. 1080p Optimal (Single Grab)
9. 1080p Transparent (Double Grab)
10. 1080p Transparent (Single Grab)
11. 2160p Optimal (Single Grab)

Enter the number(s) of the items you wish to delete, separated by commas, or type 'all' for all:
Your choice: all

Deleting Quality Profile (1080p Transparent) : SUCCESS
Deleting Quality Profile (2160p Optimal) : SUCCESS
Deleting Quality Profile (1080p Balanced) : SUCCESS
Deleting Quality Profile (1080p Balanced (Single Grab)) : SUCCESS
Deleting Quality Profile (1080p h265 Balanced) : SUCCESS
Deleting Quality Profile (1080p h265 Balanced (Single Grab)) : SUCCESS
Deleting Quality Profile (1080p Optimal) : SUCCESS
Deleting Quality Profile (1080p Optimal (Single Grab)) : SUCCESS
Deleting Quality Profile (1080p Transparent (Double Grab)) : SUCCESS
Deleting Quality Profile (1080p Transparent (Single Grab)) : SUCCESS
Deleting Quality Profile (2160p Optimal (Single Grab)) : SUCCESS
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

## Contributing

- I've added a docker compose file for testing custom formats / quality profiles. Run `docker-compose up -d` to start the Radarr/ Sonarr test containers. Add your API keys to the `config.yml` file and begin testing!

# TRaSH Guides

Some custom formats found here have been interated on from the trash guides. Credit for these goes entirely to trash, and can be found on their site here. It is not my intention to steal their work, but rather to build on it and make it more accessible to the average user through my quality profiles. Please check out their site for more information on their work.

https://trash-guides.info/
