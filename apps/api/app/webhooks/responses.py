from pydantic import BaseModel


class BunqWebhookResponse(BaseModel):
    status: str
    drop_state: str | None = None
    detail: str | None = None


class BunqRegisterCallbacksResponse(BaseModel):
    status: str
    callback_url: str
    categories: list[str]
