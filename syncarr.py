import yaml
import json
import shutil
import os
import exportarr  # Assuming this module contains the export functions
import importarr  # Assuming this module contains the import functions

def sync_data(sync_mode=False):
    # Load configuration from YAML file
    with open('config.yml', 'r') as config_file:
        config = yaml.safe_load(config_file)

    # Specify the temporary path where files will be saved
    temp_cf_path = './temp_directory/custom_formats'
    temp_qf_path = './temp_directory/quality_profiles'

    # Get user choice for app (radarr/sonarr)
    app_choice = input("Select the app you want to sync:\n1. Radarr\n2. Sonarr\nEnter your choice (1 or 2): ").strip()

    while app_choice not in ["1", "2"]:
        print("Invalid input. Please enter 1 for Radarr or 2 for Sonarr.")
        app_choice = input("Enter your choice (1 or 2): ").strip()

    app_choice = "radarr" if app_choice == "1" else "sonarr"

    instance_name = "temp"
    exportarr.export_cf(app_choice, instance_name, save_path=temp_cf_path)
    exportarr.export_qf(app_choice, instance_name, save_path=temp_qf_path)

    # Sync with each extra installation of the chosen app
    for extra_instance in config['instances'].get('extras', {}).get(app_choice, []):
        print(f"Importing to instance: {extra_instance['name']}")

        # Import custom formats and quality profiles to each extra instance
        extra_instance['app_name'] = app_choice
        importarr.import_custom_formats(extra_instance, import_path=temp_cf_path, selected_files=None, sync_mode=sync_mode)
        importarr.import_quality_profiles(extra_instance, import_path=temp_qf_path, selected_files=None, sync_mode=sync_mode)

    # Delete the temporary directories after the sync is complete
    temp_directory = './temp_directory'
    if os.path.exists(temp_directory):
        shutil.rmtree(temp_directory)
        print(f"Deleted temporary directory: {temp_directory}")

if __name__ == "__main__":
    # Set sync_mode to True to enable automatic selection of all files during import
    sync_data(sync_mode=True)