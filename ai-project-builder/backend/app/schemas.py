from pydantic import BaseModel, Field
from typing import Literal

class AnalyzeRequest(BaseModel):
    topic: str = Field(min_length=5, max_length=20000)
    stack: str = Field(default="React + FastAPI", max_length=100)

class GenerateRequest(AnalyzeRequest):
    project_name: str = Field(default="generated-project", min_length=1, max_length=80)

class PublishRequest(BaseModel):
    project_id: str
    owner: str = Field(min_length=1, max_length=100)
    repo: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    description: str = Field(default="", max_length=350)
    private: bool = False
    branch: str = Field(default="main", min_length=1, max_length=100, pattern=r"^[A-Za-z0-9._/-]+$")
    create_repo: bool = False
    confirmed: bool = False
