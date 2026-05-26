import os
import subprocess
from dotenv import load_dotenv

load_dotenv(".env.test")

query = os.getenv("SEARCH_QUERY", "Apprentissage Data science")
cv = os.getenv("CV_PATH")
provider = "azure"
key = os.getenv("AZURE_OPENAI_KEY")
endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
theme = os.getenv("CV_THEME", "Classic Dark")

cmd = [
    "python", "backend/job_hunter_agent.py",
    "--query", query,
    "--cv", cv,
    "--provider", provider,
    "--key", key,
    "--endpoint", endpoint,
    "--deployment", deployment,
    "--theme", theme
]

print(f"Lancement de la mission pour : {query}...")
subprocess.run(cmd)
