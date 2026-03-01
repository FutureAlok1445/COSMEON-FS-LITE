import asyncio
import json
import os
import httpx
import websockets
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, VerticalScroll, Grid, Container
from textual.widgets import Header, Footer, RichLog, Button, Input, Label, Static, ProgressBar, TabbedContent, TabPane, DataTable
from textual.worker import Worker, get_current_worker

class CosmeonCLI(App):
    """An advanced, highly-styled interactive CLI for COSMEON FS-LITE."""

    TITLE = "COSMEON FS-LITE"
    SUB_TITLE = "TERMINAL MISSION CONTROL V2.0"

    CSS = """
    Screen {
        background: #0B0E14;
        color: #E2E8F0;
    }
    Header {
        background: #0ea5e9;
        color: #0f172a;
        text-style: bold;
    }
    Footer {
        background: #0f172a;
        color: #38bdf8;
    }

    TabbedContent {
        height: 100%;
    }

    /* GRID FOR DASHBOARD */
    #dashboard-grid {
        layout: grid;
        grid-size: 2;
        grid-columns: 1fr 1fr;
        grid-rows: auto 1fr;
        padding: 1;
        grid-gutter: 1;
        height: 100%;
    }

    #metrics-panel {
        column-span: 2;
        height: auto;
        layout: horizontal;
        border: round #0ea5e9;
        background: #0f172a;
        padding: 1;
    }

    .metric-box {
        width: 1fr;
        text-align: center;
        border-right: solid #1e293b;
    }
    .metric-title { color: #94a3b8; text-style: bold; }
    .metric-value { color: #38bdf8; text-style: bold; }
    #last-metric-box { border-right: none; }

    #nodes-table, #files-table {
        border: round #334155;
        background: #020617;
        height: 1fr;
    }
    
    #spacer { height: 2; }

    /* PAYLOAD & CHAOS LAYOUT */
    .split-layout {
        layout: horizontal;
        height: 100%;
    }
    .control-panel {
        width: 40%;
        height: 100%;
        border-right: solid #1e293b;
        padding: 1 2;
        background: #0f172a;
    }
    .log-panel {
        width: 60%;
        height: 100%;
        padding: 1;
        background: #000000;
        border: blank;
    }

    /* STYLING */
    .section-title {
        text-align: center;
        text-style: bold;
        color: #38bdf8;
        margin-top: 1;
        margin-bottom: 2;
        border-bottom: solid #0ea5e9;
        padding-bottom: 1;
    }

    Button { width: 100%; margin-bottom: 1; text-style: bold; }
    #btn_upload { background: #0ea5e9; color: black; border: none; }
    #btn_upload:hover { background: #38bdf8; }
    #btn_download { background: #10b981; color: black; border: none; }
    #btn_download:hover { background: #34d399; }
    #btn_delete { background: #ef4444; color: black; border: none; }
    #btn_delete:hover { background: #f87171; }
    
    #btn_flare { background: #f59e0b; color: black; border: none; }
    #btn_flare:hover { background: #fbbf24; }
    #btn_rot { background: #8b5cf6; color: black; border: none; }
    #btn_rot:hover { background: #a78bfa; }
    #btn_restore { background: #020617; border: solid #10b981; color: #10b981;}
    #btn_restore:hover { background: #10b981; color: black; }

    Input { background: #1e293b; margin-bottom: 2; border: tall #334155; }
    Input:focus { border: tall #0ea5e9; }
    
    #telemetry_log_payload, #telemetry_log_chaos {
        height: 1fr;
        border: blank;
        background: #000000;
        padding: 1;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit CLI"), 
        ("c", "clear_log", "Clear Log"),
        ("r", "refresh_data", "Refresh Tables")
    ]

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True, icon="🛰️")
        
        with TabbedContent():
            # ========================
            # TAB 1: SYSTEM DASHBOARD
            # ========================
            with TabPane("🌐 SYSTEM DASHBOARD", id="tab-dashboard"):
                with Grid(id="dashboard-grid"):
                    with Horizontal(id="metrics-panel"):
                        with Vertical(classes="metric-box"):
                            yield Label("NETWORK STATUS", classes="metric-title")
                            yield Static("CONSTELLATION ONLINE", id="dash_status", classes="metric-value")
                        with Vertical(classes="metric-box"):
                            yield Label("GLOBAL CAPACITY", classes="metric-title")
                            yield Static("0 GB / 250 GB", id="dash_capacity", classes="metric-value")
                        with Vertical(classes="metric-box", id="last-metric-box"):
                            yield Label("ACTIVE PAYLOADS", classes="metric-title")
                            yield Static("0 FILES", id="dash_files", classes="metric-value")
                    
                    yield DataTable(id="nodes-table")
                    yield DataTable(id="files-table")

            # ========================
            # TAB 2: PAYLOAD OPS
            # ========================
            with TabPane("🚀 PAYLOAD OPS", id="tab-payload"):
                with Horizontal(classes="split-layout"):
                    with VerticalScroll(classes="control-panel"):
                        yield Label("DATA UPLINK", classes="section-title")
                        yield Input(placeholder="Absolute File Path (e.g. C:\\payload.bin)", id="file_input")
                        yield Button("INITIATE TRANSMISSION", id="btn_upload")
                        
                        yield Static("", id="spacer")
                        
                        yield Label("DATA DOWNLINK / ERASE", classes="section-title")
                        yield Input(placeholder="Target Payload UUID", id="uuid_input")
                        yield Button("RECONSTRUCT FROM ORBIT", id="btn_download")
                        yield Button("ERASE PAYLOAD", id="btn_delete")
                        
                        yield ProgressBar(id="op_progress", show_eta=False, total=100)
                        
                    with Vertical(classes="log-panel"):
                        yield Label("📡 LIVE TRANSMISSION TELEMETRY", classes="section-title")
                        yield RichLog(id="telemetry_log_payload", markup=True, highlight=True, wrap=True)

            # ========================
            # TAB 3: CHAOS ENGINEERING
            # ========================
            with TabPane("☢️ CHAOS OPS", id="tab-chaos"):
                with Horizontal(classes="split-layout"):
                    with VerticalScroll(classes="control-panel"):
                        yield Label("TARGETED FAILURES", classes="section-title")
                        yield Static("[dim]Inject catastrophic events into the orbital mesh to test Reed-Solomon resilience.[/]\n")
                        yield Button("SOLAR FLARE (Kill Plane Beta)", id="btn_flare")
                        yield Button("RADIATION BIT ROT (Corrupt SAT-01)", id="btn_rot")
                        yield Static("\n")
                        yield Button("RESTORE CONSTELLATION", id="btn_restore")
                        
                    with Vertical(classes="log-panel"):
                        yield Label("⚠️ INCIDENT RESPONSE FEED", classes="section-title")
                        yield RichLog(id="telemetry_log_chaos", markup=True, highlight=True, wrap=True)

        yield Footer()

    async def on_mount(self) -> None:
        self.log_p = self.query_one("#telemetry_log_payload", RichLog)
        self.log_c = self.query_one("#telemetry_log_chaos", RichLog)
        self.progress = self.query_one(ProgressBar)
        self.progress.display = False
        
        # Setup DataTables
        nodes_table = self.query_one("#nodes-table", DataTable)
        nodes_table.add_columns("NODE ID", "PLANE", "STATUS", "HEALTH", "CHUNKS", "STORAGE")
        
        files_table = self.query_one("#files-table", DataTable)
        files_table.add_columns("FILENAME", "UUID", "SIZE", "CHUNKS")
        
        self.log_p.write("[dim]Payload Operations initialized. Standing by for Uplink/Downlink...[/]")
        self.log_c.write("[dim]Chaos Subsystem armed. Awaiting simulation trigger...[/]")
        
        self.run_worker(self.fetch_dashboard_data(), exclusive=True)
        self.run_worker(self.telemetry_listener(), exclusive=True)

    def action_clear_log(self) -> None:
        self.log_p.clear()
        self.log_c.clear()
        
    def action_refresh_data(self) -> None:
        self.run_worker(self.fetch_dashboard_data(), exclusive=True)

    async def fetch_dashboard_data(self):
        """Fetch REST API to populate Nodes and Files tables."""
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get("http://localhost:8000/api/state", timeout=5.0)
                if res.status_code == 200:
                    state = res.json()
                    
                    # Update Metrics
                    nodes = state.get("nodes", [])
                    files = state.get("files", [])
                    total_storage = sum(n.get("storage_used", 0) for n in nodes)
                    
                    self.query_one("#dash_capacity").update(f"{(total_storage/1024):.2f} KB / 250 GB")
                    self.query_one("#dash_files").update(f"{len(files)} FILES")
                    
                    # Update Nodes Table
                    nodes_table = self.query_one("#nodes-table", DataTable)
                    nodes_table.clear()
                    for n in nodes:
                        status = n.get("status")
                        s_color = "[green]" if status == "ONLINE" else "[red]"
                        nodes_table.add_row(
                            n.get("node_id"), 
                            n.get("plane"), 
                            f"{s_color}{status}[/]",
                            f"{n.get('health_score')}%", 
                            str(n.get("chunk_count")), 
                            f"{(n.get('storage_used')/1024):.1f}KB"
                        )
                        
                    # Update Files Table
                    files_table = self.query_one("#files-table", DataTable)
                    files_table.clear()
                    for f in files:
                        files_table.add_row(
                            f.get("filename"),
                            f.get("file_id")[:8] + "...",
                            f"{(f.get('size')/1024):.1f}KB",
                            str(f.get("chunk_count"))
                        )
            except Exception:
                self.query_one("#dash_status").update("[bold red]API UNREACHABLE[/]")

    async def telemetry_listener(self):
        worker = get_current_worker()
        uri = "ws://localhost:8000/ws"
        while not worker.is_cancelled:
            try:
                async with websockets.connect(uri) as ws:
                    self.query_one("#dash_status").update("[bold green]MESH SYNCED[/]")
                    
                    async for message in ws:
                        if worker.is_cancelled:
                            break
                        data = json.loads(message)
                        msg_type = data.get("type", "INFO")
                        msg_text = data.get("message", "")
                        msg_data = data.get("data", {})
                        
                        # Route message to correct log and format
                        target_log = self.log_p
                        color = "cyan"
                        prefix = "ℹ️"
                        
                        # Is it a Chaos event?
                        if msg_type in ["SOLAR_FLARE", "RADIATION_STRIKE", "RESTORE_CONSTELLATION"]:
                            target_log = self.log_c
                            msg_text = f"[bold]{msg_type}[/bold]: {msg_text}"
                            if msg_type == "RESTORE_CONSTELLATION": color = "green"; prefix = "✅"
                            else: color = "red"; prefix = "💥"
                            self.action_refresh_data() # Auto refresh dashboard on chaos
                        
                        # Payload Operation explicit mappings
                        elif msg_type == "UPLOAD_START":
                            msg_text = f"UPLINK INITIATED: {msg_data.get('filename', 'Unknown')} ({(msg_data.get('size', 0) / 1024):.2f} KB)"
                            color = "cyan"  ; prefix = "🚀"
                        elif msg_type == "CHUNKING_COMPLETE":
                            msg_text = f"PARTITIONING: Splitting into {msg_data.get('chunk_count', 0)} geometric shards"
                            color = "yellow"; prefix = "🔪"
                        elif msg_type == "ENCODING_COMPLETE":
                            msg_text = f"REED-SOLOMON: Generating parity. Total shards: {msg_data.get('total_shards', 0)}"
                            color = "magenta"; prefix = "🧬"
                        elif msg_type == "CHUNK_UPLOADED":
                            msg_text = f"ROUTING: Shard secured on {msg_data.get('node_id', 'Unknown')} (Plane {msg_data.get('plane', 'Unknown')})"
                            color = "green" ; prefix = "📡"
                        elif msg_type == "DTN_QUEUED":
                            msg_text = f"DTN SPOOLED: Target offline. Queued for {msg_data.get('node_id', 'Unknown')}"
                            color = "yellow"; prefix = "💾"
                        elif msg_type == "UPLOAD_COMPLETE":
                            fs_id = msg_data.get('file_id', '')
                            short_id = fs_id.split('-')[0] + '...' if fs_id else ''
                            msg_text = f"UPLINK COMPLETE: Global distribution verified. UUID: {short_id}"
                            color = "green" ; prefix = "✅"
                            self.action_refresh_data()
                        elif msg_type == "DOWNLOAD_START":
                            msg_text = f"DOWNLINK INITIATED: Locating {msg_data.get('filename', 'file')}"
                            color = "cyan"  ; prefix = "🛰️"
                        elif msg_type == "DOWNLOAD_COMPLETE":
                            msg_text = f"RECONSTRUCTION: Decoded via RS. Latency: {msg_data.get('latency', 0)}ms"
                            if msg_data.get("rs_recovery", 0) > 0:
                                target_log.write(f"[yellow][bold]⚠️ [PARITY_USED][/bold] {msg_data.get('rs_recovery')} missing shards mathematically recovered.[/]")
                            color = "green" ; prefix = "✅"
                        elif msg_type == "FILE_DELETED":
                            msg_text = f"ERASURE COMPLETE: {msg_text}"
                            color = "red" ; prefix = "🗑️"
                            self.action_refresh_data()
                        else:
                            # Generic event
                            if any(k in msg_type for k in ("SUCCESS", "COMPLETE")): color = "green"; prefix = "✅"
                            elif any(k in msg_type for k in ("ERROR", "CORRUPT")): color = "red"; prefix = "🚨"
                            elif any(k in msg_type for k in ("WARNING")): color = "yellow"; prefix = "⚠️"
                            
                        target_log.write(f"[{color}][bold]{prefix} [{msg_type}][/bold] {msg_text}[/]")
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.query_one("#dash_status").update("[bold red]MESH OFFLINE[/]")
                await asyncio.sleep(2)

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id
        
        if btn_id == "btn_upload":
            file_path = self.query_one("#file_input", Input).value.strip()
            if not file_path or not os.path.exists(file_path):
                self.log_p.write(f"[bold red]❌ [ERROR] File not found '{file_path}'.[/]")
                return
            self.run_worker(self.upload_file(file_path))
            
        elif btn_id == "btn_download":
            uuid = self.query_one("#uuid_input", Input).value.strip()
            if not uuid: return
            self.run_worker(self.download_file(uuid))
            
        elif btn_id == "btn_delete":
            uuid = self.query_one("#uuid_input", Input).value.strip()
            if not uuid: return
            self.run_worker(self.delete_file(uuid))
            
        elif btn_id == "btn_flare":
            self.run_worker(self.trigger_chaos("solar_flare"))
        elif btn_id == "btn_rot":
            self.run_worker(self.trigger_chaos("bit_rot"))
        elif btn_id == "btn_restore":
            self.run_worker(self.trigger_chaos("restore"))

    async def trigger_chaos(self, endpoint: str):
        self.log_c.write(f"[dim]Initiating Override Sequence: {endpoint.upper()}[/]")
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(f"http://localhost:8000/api/chaos/{endpoint}", timeout=10.0)
            except Exception as e:
                self.log_c.write(f"[bold red]🚨 [API OUTAGE] Failed to contact main server: {e}[/]")

    async def delete_file(self, file_id: str):
        self.log_p.write(f"[bold red]🗑️ [ERASE] Issuing kill command for {file_id[:8]}...[/]")
        async with httpx.AsyncClient() as client:
            try:
                res = await client.delete(f"http://localhost:8000/api/delete/{file_id}", timeout=10.0)
                if res.status_code != 200:
                    self.log_p.write(f"[bold red]❌ [ERROR] Erasure failed: {res.text}[/]")
            except Exception as e:
                self.log_p.write(f"[bold red]🚨 [FATAL ERROR] {e}[/]")

    async def upload_file(self, file_path: str):
        self.progress.display = True
        self.progress.progress = 25
        self.log_p.write(f"[bold cyan]⏫ [UPLINK] Target acquired: {os.path.basename(file_path)}[/]")
        
        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            
            async with httpx.AsyncClient() as client:
                files = {'file': (os.path.basename(file_path), file_bytes, 'application/octet-stream')}
                self.progress.progress = 75
                res = await client.post("http://localhost:8000/api/upload", files=files, timeout=30.0)
                
                if res.status_code == 200:
                    data = res.json()
                    self.query_one("#uuid_input", Input).value = data["file_id"]
                    self.progress.progress = 100
                else:
                    self.log_p.write(f"[bold red]❌ [ERROR] Space segment rejected uplink: {res.text}[/]")
                    self.progress.progress = 0
        except Exception as e:
            self.log_p.write(f"[bold red]🚨 [FATAL ERROR] {e}[/]")
            self.progress.progress = 0
            
        await asyncio.sleep(1)
        self.progress.display = False

    async def download_file(self, file_id: str):
        self.progress.display = True
        self.progress.progress = 25
        self.log_p.write(f"[bold cyan]⏬ [DOWNLINK] Requesting shard geometry for {file_id[:8]}...[/]")
        
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
                    self.log_p.write(f"[bold green]✅ [SUCCESS] Written to cli_downloads/{filename}[/]")
                    self.progress.progress = 100
                else:
                    self.log_p.write(f"[bold red]❌ [ERROR] Downlink integrity failure: {res.text}[/]")
                    self.progress.progress = 0
        except Exception as e:
            self.log_p.write(f"[bold red]🚨 [FATAL ERROR] {e}[/]")
            self.progress.progress = 0
            
        await asyncio.sleep(1)
        self.progress.display = False

if __name__ == "__main__":
    app = CosmeonCLI()
    app.run()
