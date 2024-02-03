config_content = """
instances:
  sonarr:
    - name: "Master"
      url: "http://localhost:8989"
      api_key: "API_KEY"
    - name: "4k-sonarr"
      url: "http://localhost:8998"
      api_key: "API_KEY"
  radarr:
    - name: "Master"
      url: "http://localhost:7878"
      api_key: "API_KEY"
    - name: "4k-radarr"
      url: "http://localhost:7887"
      api_key: "API_KEY"

settings:
  export_path: "./exports"

"""

with open('config.yml', 'w') as file:
    file.write(config_content)
