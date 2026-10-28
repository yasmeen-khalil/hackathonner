import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# Keep CrewAI quiet and offline except for the model calls we make on purpose.
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

PARASAIL_BASE = "https://api.parasail.io/v1"
PARASAIL_API_KEY = os.environ.get("PARASAIL_API_KEY", "")
MAIN_MODEL = os.environ.get("PARASAIL_MODEL", "parasail-glm-53-flash")
FAST_MODEL = os.environ.get("PARASAIL_FAST_MODEL", "parasail-deepseek-v4-flash")
YDC_API_KEY = os.environ.get("YDC_API_KEY", "")
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "app.db"
