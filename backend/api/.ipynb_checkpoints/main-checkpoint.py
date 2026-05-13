"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import upload, overview, team, ca, forecast, smoothing, decisions, complexity

app = FastAPI(title="WTB Workload Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(team.router, prefix="/api")
app.include_router(ca.router, prefix="/api")
app.include_router(forecast.router, prefix="/api")
app.include_router(smoothing.router, prefix="/api")
app.include_router(decisions.router, prefix="/api")
app.include_router(complexity.router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
