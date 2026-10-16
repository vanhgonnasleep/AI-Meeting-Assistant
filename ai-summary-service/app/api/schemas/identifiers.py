"""Integer bounds shared by request contracts and SQLite-backed routes."""
from typing import Annotated

from pydantic import Field

SQLITE_MAX_INTEGER = 2**63 - 1
StoredId = Annotated[int, Field(ge=1, le=SQLITE_MAX_INTEGER)]
