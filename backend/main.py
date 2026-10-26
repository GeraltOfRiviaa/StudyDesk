import os
from fastapi import FastAPI
from pymongo import AsyncMongoClient

app = FastAPI()
db = AsyncMongoClient(os.environ["MONGO_URL"], tz_aware=True).studydesk

@app.get("/health")
async def health():
    await db.command("ping")
    return {"status": "ok"}
