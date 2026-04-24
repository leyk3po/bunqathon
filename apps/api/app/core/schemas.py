from pydantic import BaseModel


class ApiMeta(BaseModel):
    name: str
    environment: str
    docs: str
    health: str
    api_base: str
