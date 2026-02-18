from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from processing import analyze_image
import traceback

app = FastAPI(title="Luminol Image Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
async def analyze_endpoint(
    image: UploadFile = File(...),
    shutter_seconds: float = Form(0),
    exposure_time: float = Form(0),       # legacy alias
    iso: float = Form(0),
    sensitivity: float = Form(50),
    capture_mode: str = Form("jpeg"),
):
    t = shutter_seconds if shutter_seconds > 0 else exposure_time
    try:
        contents = await image.read()
        result = analyze_image(contents, t, iso, sensitivity, capture_mode)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/preview")
async def preview_endpoint(
    image: UploadFile = File(...),
    shutter_seconds: float = Form(0),
    exposure_time: float = Form(0),
    iso: float = Form(0),
    sensitivity: float = Form(50),
    capture_mode: str = Form("jpeg"),
):
    """
    Same computation as /analyze — separate endpoint for semantic clarity.
    Frontend calls this on per-image slider changes (debounced).
    """
    t = shutter_seconds if shutter_seconds > 0 else exposure_time
    try:
        contents = await image.read()
        result = analyze_image(contents, t, iso, sensitivity, capture_mode)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {"status": "ok"}
