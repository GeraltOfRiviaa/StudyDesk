from fastapi import FastAPI
from database import db
from routers import users 


app = FastAPI()
app.include_router(users.router)

@app.get("/health")
async def health():
    await db.command("ping")
    return {"status": "ok"}