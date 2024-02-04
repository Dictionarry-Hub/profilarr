from exportarr import export_custom_formats, export_quality_profiles
from importarr import import_custom_formats, import_quality_profiles
from helpers import load_config, get_app_choice

def main():
    app = get_app_choice().lower()  # Convert to lowercase
    config = load_config()  # Load the entire configuration

    # Now app will be 'radarr' or 'sonarr', matching the keys in the config dictionary
    master_instance = next((inst for inst in config['instances'][app] if inst['name'] == 'Master'), None)
    extra_instances = [inst for inst in config['instances'][app] if inst['name'] != 'Master']

    if master_instance:
        export_custom_formats(app, [master_instance], config)
        export_quality_profiles(app, [master_instance], config)
    
    if extra_instances:
        import_custom_formats(app, extra_instances)
        import_quality_profiles(app, extra_instances)

if __name__ == "__main__":
    main()
