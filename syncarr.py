import exportarr 
import importarr  
import json
import shutil
import os

def sync_data():
    # Load configuration for main app
    with open('config.json', 'r') as config_file:
        config = json.load(config_file)

    # Specify the temporary path where files were saved
    temp_cf_path = './temp_directory/custom_formats'
    temp_qf_path = './temp_directory/quality_profiles'

    # Get user choice for app (radarr/sonarr)
    app_choice = importarr.get_user_choice()
    
    # Export data for the chosen app
    exportarr.export_cf(app_choice, save_path=temp_cf_path)
    exportarr.export_qf(app_choice, save_path=temp_qf_path)

    # Sync with each extra installation of the chosen app
    for extra_instance in config['extra_installations'].get(app_choice, []):
        source_config = extra_instance
        print(f"Importing to instance: {extra_instance['name']}")

        # Import custom formats and quality profiles to each extra instance
        importarr.import_custom_formats(source_config, import_path=temp_cf_path, auto_select_file=True)
        importarr.import_quality_profiles(source_config, import_path=temp_qf_path)

    # Delete the temporary directories after the sync is complete
    temp_directory = './temp_directory'
    if os.path.exists(temp_directory):
        shutil.rmtree(temp_directory)
        print(f"Deleted temporary directory: {temp_directory}")

if __name__ == "__main__":
    sync_data()
