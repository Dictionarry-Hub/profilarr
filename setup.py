import os
master_radarr_base_url = os.environ.get("MASTER_RADAR_BASEURL", "http://localhost:7878")
master_radarr_apikey = os.environ.get("MASTER_RADAR_APIKEY", "API_KEY")
dev_radarr_base_url = os.environ.get("DEV_RADAR_BASEURL", "http://localhost:7887")
dev_radarr_apikey = os.environ.get("DEV_RADAR_APIKEY", "API_KEY")
config_content = f"""
instances:
  radarr:
    - name: "Master"
      base_url: "{master_radarr_base_url}"
      api_key: "API_KEY"
    - name: "DEV"
      base_url: "{dev_radarr_base_url}"
      api_key: "API_KEY"
  sonarr:
    - name: "Master"
      base_url: "http://localhost:8989"
      api_key: "API_KEY"
    - name: "DEV"
      base_url: "http://localhost:8998"
      api_key: "API_KEY"
settings:
  export_path: "./exports"
  import_path: "./imports"
  ansi_colors: true

"""

with open('config.yml', 'w') as file:
    file.write(config_content)
