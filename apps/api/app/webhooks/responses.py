from pydantic import BaseModel


class BunqWebhookResponse(BaseModel):
    status: str
    drop_state: str
