from fastapi import FastAPI, Depends
from database import db
from routers import users 
from core.security import get_current_user



app = FastAPI(swagger_ui_parameters={"persistAuthorization": True})
app.include_router(users.router)

@app.get("/health")
async def health(user: dict = Depends(get_current_user)):
    await db.command("ping")
    return {"status": "ok"}