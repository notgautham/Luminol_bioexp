from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from processing import analyze_image
import io

app = FastAPI(title="Luminol Image Analysis API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_endpoint(
    image: UploadFile = File(...),
    exposure_time: float = Form(...),
    iso: float = Form(...)
):
    try:
        contents = await image.read()
        result = analyze_image(contents, exposure_time, iso)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}
