from fastapi import FastAPI, Depends
from database import db
from routers import users, notes
from core.security import get_current_user
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI(swagger_ui_parameters={"persistAuthorization": True})
app.include_router(users.router)
app.include_router(notes.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health(user: dict = Depends(get_current_user)):
    await db.command("ping")
    return {"status": "ok"}