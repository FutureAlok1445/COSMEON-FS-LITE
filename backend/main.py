import uuid
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from backend.config import CHUNK_SIZE, init_node_folders
from backend.core.chunker import chunk_file, _compute_hash
from backend.core.encoder import encode_chunks
from backend.core.distributor import distribute_shards
from backend.core.reassembler import fetch_and_reassemble
from backend.metadata.manager import register_file, get_file, init_store
from backend.utils.ws_manager import manager
from backend.intelligence.chaos import router as chaos_router
from backend.intelligence.dtn_queue import dtn_flush_worker
from backend.intelligence.trajectory import orbit_timer_worker
from backend.intelligence.predictor import predictor_worker
from backend.intelligence.rebalancer import rebalancer_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the store.json and node folders
    init_node_folders()
    init_store()
    
    # Start all Person 3 background workers
    dtn_task = asyncio.create_task(dtn_flush_worker())
    orbit_task = asyncio.create_task(orbit_timer_worker())
    predictor_task = asyncio.create_task(predictor_worker())
    rebalancer_task = asyncio.create_task(rebalancer_worker())
    
    yield
    
    # Shutdown
    dtn_task.cancel()
    orbit_task.cancel()
    predictor_task.cancel()
    rebalancer_task.cancel()

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
        full_hash = _compute_hash(content)
        
        await manager.broadcast("UPLOAD_START", f"Ingesting {file.filename}")
        
        base_chunks, _ = chunk_file(content)
        shards = encode_chunks(base_chunks)
        
        # Note: distribute_shards should return List[ChunkRecord] in the new architecture
        allocation_ledger = distribute_shards(file_id, shards)
        
        from backend.metadata.schemas import FileRecord
        file_record = FileRecord(
            file_id=file_id,
            filename=file.filename,
            full_sha256=full_hash,
            size=len(content),
            chunk_count=len(allocation_ledger),
            chunks=allocation_ledger
        )
        register_file(file_record)
        
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
    record = get_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File ID not found.")
        
    try:
        from backend.metadata.manager import get_node
        # Adapt retrieve_file_shards to use the new chunk records and get_node_status callback
        file_bytes = await fetch_and_reassemble(
            [c.model_dump() for c in record.chunks],
            lambda node_id: get_node(node_id).status if get_node(node_id) else "OFFLINE",
            record.full_sha256
        )
        
        if _compute_hash(file_bytes) != record.full_sha256:
            await manager.broadcast("FILE_CORRUPTED", "Catastrophic error: Final hash mismatch.")
            raise Exception("Final File Integrity Verification FAILED.")
            
        await manager.broadcast("DOWNLOAD_COMPLETE", "File reconstructed and verified 100% intact.")
        
        # Pass the original filename to the client
        original_filename = record.filename
        headers = {
            "Content-Disposition": f'attachment; filename="{original_filename}"'
        }
        return Response(content=file_bytes, media_type="application/octet-stream", headers=headers)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
