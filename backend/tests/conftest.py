import pytest
from pathlib import Path
from domain.loader import parse_workbook, DataBundle

DATA_PATH = Path(__file__).parent.parent.parent / "docs" / "wtb_data.xlsx"


@pytest.fixture(scope="session")
def bundle() -> DataBundle:
    with open(DATA_PATH, "rb") as f:
        return parse_workbook(f.read())
