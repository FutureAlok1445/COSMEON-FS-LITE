import uuid
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from backend.config import CHUNK_SIZE, init_fs
from backend.core.chunker import split_file, compute_sha256
from backend.core.encoder import encode_rs_shards
from backend.core.distributor import distribute_shards
from backend.core.reassembler import retrieve_file_shards
from backend.metadata.manager import save_file_record, get_file_record
from backend.utils.ws_manager import manager
from backend.intelligence.chaos import router as chaos_router
from backend.intelligence.dtn_queue import dtn_flush_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the DTN daemon
    dtn_task = asyncio.create_task(dtn_flush_worker())
    yield
    # Shutdown
    dtn_task.cancel()

app = FastAPI(title="COSMEON FS-LITE Final Architecture API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chaos_router)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Main orbital uplink entry point."""
    try:
        content = await file.read()
        file_id = str(uuid.uuid4())
        full_hash = compute_sha256(content)
        
        await manager.broadcast("UPLOAD_START", f"Ingesting {file.filename}")
        
        base_chunks = split_file(content, CHUNK_SIZE)
        shards = encode_rs_shards(base_chunks)
        
        allocation_ledger = distribute_shards(file_id, shards)
        
        save_file_record(file_id, {
            "filename": file.filename,
            "hash": full_hash,
            "size_bytes": len(content),
            "shards": allocation_ledger
        })
        
        await manager.broadcast("UPLOAD_COMPLETE", f"{file.filename} partitioned across orbital mesh.")
        
        return {
            "status": "success",
            "file_id": file_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """Reconstructs the file from fragments distributed in orbit."""
    record = get_file_record(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File ID not found.")
        
    try:
        file_bytes = await retrieve_file_shards(file_id, record)
        
        if compute_sha256(file_bytes) != record["hash"]:
            await manager.broadcast("FILE_CORRUPTED", "Catastrophic error: Final hash mismatch.")
            raise Exception("Final File Integrity Verification FAILED.")
            
        await manager.broadcast("DOWNLOAD_COMPLETE", "File reconstructed and verified 100% intact.")
        return Response(content=file_bytes, media_type="application/octet-stream")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
