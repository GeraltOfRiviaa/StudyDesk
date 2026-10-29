from fastapi import FastAPI
from database import db


app = FastAPI()


@app.get("/health")
async def health():
    await db.command("ping")
    return {"status": "ok"}