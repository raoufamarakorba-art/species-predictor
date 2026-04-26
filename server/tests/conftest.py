from pathlib import Path
import os
import sys

import pytest


SERVER_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = SERVER_DIR.parent
TEST_DB = ROOT_DIR / ".pytest_cache" / "species_predictor_test.sqlite3"

os.environ["SPECIES_DATABASE_PATH"] = str(TEST_DB)

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(autouse=True)
def clean_test_database():
    TEST_DB.parent.mkdir(parents=True, exist_ok=True)
    if TEST_DB.exists():
        TEST_DB.unlink()
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()
