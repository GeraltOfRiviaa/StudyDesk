from fastapi import FastAPI
from database import db
from routers import notes

app = FastAPI()


app.include_router(notes.router)

@app.get("/health")
async def health():
    await db.command("ping")
    return {"status": "ok"}