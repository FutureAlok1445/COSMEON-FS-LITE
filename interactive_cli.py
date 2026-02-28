import asyncio
import json
import os
import httpx
import websockets
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.widgets import Header, Footer, RichLog, Button, Input, Label, Static, ProgressBar
from textual.worker import Worker, get_current_worker

class CosmeonCLI(App):
    """An advanced, highly-styled interactive CLI for COSMEON FS-LITE."""

    TITLE = "COSMEON FS-LITE : TERMINAL MISSION CONTROL"
    SUB_TITLE = "ORBITAL NODE TOPOLOGY AWARENESS"

    CSS = """
    Screen {
        background: #0B0E14;
        color: #E2E8F0;
    }
    Header {
        background: #1e3a8a;
        color: #E2E8F0;
        text-style: bold;
    }
    Footer {
        background: #111827;
        color: #64748b;
    }
    
    #main-container {
        height: 100%;
        layout: horizontal;
    }

    #left-pane {
        width: 35%;
        height: 100%;
        border-right: solid #1e40af;
        padding: 1;
        background: #111827;
    }
    
    #right-pane {
        width: 65%;
        height: 100%;
        padding: 1;
        background: #000000;
        border-left: vkey #374151;
    }

    .section-title {
        text-align: center;
        text-style: bold;
        color: #22d3ee;
        margin-top: 1;
        margin-bottom: 1;
        border-bottom: solid #1e40af;
        padding-bottom: 1;
    }

    .metric-box {
        border: round #374151;
        padding: 1;
        text-align: center;
        margin-bottom: 1;
        background: #1f2937;
    }

    .metric-value {
        text-style: bold;
        color: #a78bfa;
    }

    Button {
        width: 100%;
        margin-bottom: 1;
    }

    /* Custom Button Styling */
    #btn_upload { background: #2563eb; color: white; border: none; }
    #btn_upload:hover { background: #3b82f6; }
    
    #btn_download { background: #059669; color: white; border: none; }
    #btn_download:hover { background: #10b981; }
    
    #btn_flare { background: #d97706; color: white; border: none; }
    #btn_flare:hover { background: #f59e0b; }
    
    #btn_rot { background: #7c3aed; color: white; border: none; }
    #btn_rot:hover { background: #8b5cf6; }

    #btn_restore { background: #1f2937; border: solid #4ade80; color: #4ade80;}
    #btn_restore:hover { background: #4ade80; color: #000; }

    Input {
        background: #1f2937;
        margin-bottom: 1;
        border: tall #374151;
    }
    Input:focus {
        border: tall #22d3ee;
    }

    #telemetry_log {
        height: 1fr;
        border: blank;
        background: #000000;
        padding: 1;
    }
    """

    BINDINGS = [("q", "quit", "Exit"), ("c", "clear_log", "Clear Log")]

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True, icon="🛰️")
        
        with Horizontal(id="main-container"):
            # LEFT PANE: Controls and Status
            with VerticalScroll(id="left-pane"):
                # System Status
                yield Label("🌐 SYSTEM STATUS", classes="section-title")
                yield Static("[bold green]● SECURE CONNECTION ACTIVE[/]", id="conn_status", classes="metric-box")
                
                # Action Area
                yield Label("🚀 UPLINK / DOWNLINK", classes="section-title")
                yield Input(placeholder="Abs Path (e.g. C:\\file.txt)", id="file_input")
                yield Button("UPLINK FILE TO ORBIT", id="btn_upload")
                
                yield Input(placeholder="Target File UUID", id="uuid_input")
                yield Button("RECONSTRUCT & DOWNLINK", id="btn_download")
                
                # Active Operations Feedback
                yield ProgressBar(id="op_progress", show_eta=False, total=100)
                
                # Chaos Area
                yield Label("☢️ CHAOS ENGINEERING", classes="section-title")
                yield Button("TRIGGER: Solar Flare (Kill Plane Beta)", id="btn_flare")
                yield Button("TRIGGER: Radiation Bit Rot (Corrupt SAT-01)", id="btn_rot")
                yield Button("RESTORE FULL CONSTELLATION", id="btn_restore")
                
            # RIGHT PANE: Telemetry Log
            with Vertical(id="right-pane"):
                yield Label("📡 LIVE ORBITAL TELEMETRY FEED", classes="section-title")
                yield RichLog(id="telemetry_log", markup=True, highlight=True, wrap=True)
                
        yield Footer()

    async def on_mount(self) -> None:
        self.log_widget = self.query_one(RichLog)
        self.progress = self.query_one(ProgressBar)
        self.progress.display = False # hide initially
        
        self.log_widget.write("[dim]Welcome to COSMEON Mission Control.[/]")
        self.log_widget.write("[bold cyan]Establishing high-frequency WebSocket mesh...[/]")
        
        # We start the listener
        self.run_worker(self.telemetry_listener(), exclusive=True)

    def action_clear_log(self) -> None:
        self.log_widget.clear()
        self.log_widget.write("[dim]Telemetry feed cleared.[/]")

    async def telemetry_listener(self):
        worker = get_current_worker()
        uri = "ws://localhost:8000/ws"
        while not worker.is_cancelled:
            try:
                async with websockets.connect(uri) as ws:
                    self.query_one("#conn_status").update("[bold green]● ORBITAL MESH SYNCED[/]")
                    self.log_widget.write("[bold green]WebSocket Connected.[/]")
                    
                    async for message in ws:
                        if worker.is_cancelled:
                            break
                        data = json.loads(message)
                        msg_type = data.get("type", "INFO")
                        msg_text = data.get("message", "")
                        
                        # Hacker/Console Color Rules
                        color = "cyan"
                        prefix = "ℹ️"
                        if any(k in msg_type for k in ("SUCCESS", "COMPLETE", "DELIVERED", "RESTORE")):
                            color = "green"
                            prefix = "✅"
                        elif any(k in msg_type for k in ("ERROR", "CORRUPT", "OFFLINE", "DESTROYED", "DETECTED")):
                            color = "red"
                            prefix = "🚨"
                        elif any(k in msg_type for k in ("QUEUE", "PARTITION", "WARNING")):
                            color = "yellow"
                            prefix = "⚠️"
                        elif any(k in msg_type for k in ("RECOVERY", "FLUSH")):
                            color = "magenta"
                            prefix = "🔄"
                            
                        self.log_widget.write(f"[{color}][bold]{prefix} [{msg_type}][/bold] {msg_text}[/]")
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.query_one("#conn_status").update("[bold red]○ MESH OFFLINE - RECONNECTING...[/]")
                # Prevent spamming the log too violently on disconnect
                await asyncio.sleep(2)

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id
        
        if btn_id == "btn_upload":
            file_path = self.query_one("#file_input", Input).value.strip()
            if not file_path or not os.path.exists(file_path):
                self.log_widget.write(f"[bold red]❌ [ERROR] File not found '{file_path}'.[/]")
                return
            self.run_worker(self.upload_file(file_path))
            
        elif btn_id == "btn_download":
            uuid = self.query_one("#uuid_input", Input).value.strip()
            if not uuid:
                self.log_widget.write("[bold red]❌ [ERROR] You must provide a UUID to downlink.[/]")
                return
            self.run_worker(self.download_file(uuid))
            
        elif btn_id == "btn_flare":
            self.run_worker(self.trigger_chaos("solar_flare"))
        elif btn_id == "btn_rot":
            self.run_worker(self.trigger_chaos("bit_rot"))
        elif btn_id == "btn_restore":
            self.run_worker(self.trigger_chaos("restore"))

    async def trigger_chaos(self, endpoint: str):
        self.log_widget.write(f"[dim]Initiating Override Sequence: {endpoint.upper()}[/]")
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(f"http://localhost:8000/api/chaos/{endpoint}", timeout=10.0)
            except Exception as e:
                self.log_widget.write(f"[bold red]🚨 [API OUTAGE] Failed to contact main server: {e}[/]")

    async def upload_file(self, file_path: str):
        self.progress.display = True
        self.progress.progress = 25
        self.log_widget.write(f"[bold cyan]⏫ [UPLINK] Initiating transmission sequence for {os.path.basename(file_path)}...[/]")
        
        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            
            async with httpx.AsyncClient() as client:
                files = {'file': (os.path.basename(file_path), file_bytes, 'application/octet-stream')}
                self.progress.progress = 75
                
                res = await client.post("http://localhost:8000/api/upload", files=files, timeout=30.0)
                
                if res.status_code == 200:
                    data = res.json()
                    uuid_input = self.query_one("#uuid_input", Input)
                    uuid_input.value = data["file_id"]
                    self.log_widget.write(f"[bold green]✅ [SUCCESS] File Encoded & Distributed. System UUID locked: {data['file_id']}[/]")
                    self.progress.progress = 100
                else:
                    self.log_widget.write(f"[bold red]❌ [ERROR] Space segment rejected uplink: {res.text}[/]")
                    self.progress.progress = 0
        except Exception as e:
            self.log_widget.write(f"[bold red]🚨 [FATAL ERROR] {e}[/]")
            self.progress.progress = 0
            
        await asyncio.sleep(1)
        self.progress.display = False

    async def download_file(self, file_id: str):
        self.progress.display = True
        self.progress.progress = 25
        self.log_widget.write(f"[bold cyan]⏬ [DOWNLINK] Requesting shard geometry for {file_id}...[/]")
        
        try:
            async with httpx.AsyncClient() as client:
                self.progress.progress = 75
                res = await client.get(f"http://localhost:8000/api/download/{file_id}", timeout=30.0)
                
                if res.status_code == 200:
                    downloads_dir = os.path.join(os.getcwd(), "cli_downloads")
                    os.makedirs(downloads_dir, exist_ok=True)
                    
                    filename = f"recovered_{file_id[:8]}.dat"
                    cd_header = res.headers.get("content-disposition", "")
                    if "filename=" in cd_header:
                        filename = cd_header.split("filename=")[-1].strip('"\'')
                        
                    save_path = os.path.join(downloads_dir, filename)
                    with open(save_path, "wb") as f:
                        f.write(res.content)
                    self.log_widget.write(f"[bold green]✅ [SUCCESS] Payload reconstructed perfectly. Written to cli_downloads/{filename}[/]")
                    self.progress.progress = 100
                else:
                    self.log_widget.write(f"[bold red]❌ [ERROR] Downlink integrity failure: {res.text}[/]")
                    self.progress.progress = 0
        except Exception as e:
            self.log_widget.write(f"[bold red]🚨 [FATAL ERROR] {e}[/]")
            self.progress.progress = 0
            
        await asyncio.sleep(1)
        self.progress.display = False

if __name__ == "__main__":
    app = CosmeonCLI()
    app.run()
