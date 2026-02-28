import asyncio
import json
import websockets
from datetime import datetime
import os
import sys

# ANSI Color Codes for the CLI
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

def get_color(event_type: str) -> str:
    """Matches the GUI color coding for the CLI."""
    if any(k in event_type for k in ("SUCCESS", "COMPLETE", "DELIVERED", "RESTORE")):
        return Colors.GREEN
    if any(k in event_type for k in ("ERROR", "CORRUPT", "OFFLINE", "DESTROYED", "DETECTED")):
        return Colors.RED
    if any(k in event_type for k in ("QUEUE", "PARTITION", "WARNING")):
        return Colors.YELLOW
    if any(k in event_type for k in ("RECOVERY", "FLUSH")):
        return Colors.PURPLE
    return Colors.CYAN

async def cli_monitor(uri="ws://localhost:8000/ws"):
    """
    Connects to the FastAPI WebSocket and streams live mission telemetry
    directly to the CLI, mirroring the GUI's Mission Log panel.
    """
    os.system('cls' if os.name == 'nt' else 'clear')
    print(f"{Colors.BOLD}{Colors.CYAN}COSMEON FS-LITE — ORBITAL TELEMETRY LINK ESTABLISHED{Colors.RESET}")
    print(f"{Colors.DIM}Listening on {uri}...\n{Colors.RESET}")
    
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                async for message_str in websocket:
                    try:
                        data = json.loads(message_str)
                        log_type = data.get("type", "INFO")
                        log_msg = data.get("message", "")
                        
                        # Formatting time
                        dt_string = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                        
                        color = get_color(log_type)
                        
                        # CLI Output format: [Time] [TYPE] Message
                        print(f"{Colors.DIM}[{dt_string}]{Colors.RESET} {color}{Colors.BOLD}[{log_type}]{Colors.RESET} {color}{log_msg}{Colors.RESET}")
                        
                    except json.JSONDecodeError:
                        print(f"{Colors.DIM}Raw: {message_str}{Colors.RESET}")
                        
        except (websockets.exceptions.ConnectionClosedError, ConnectionRefusedError):
            print(f"{Colors.RED}Connection lost. Retrying in 2 seconds...{Colors.RESET}")
            await asyncio.sleep(2)
        except Exception as e:
            print(f"{Colors.RED}CLI Error: {e}{Colors.RESET}")
            break

if __name__ == "__main__":
    try:
        if sys.platform == 'win32':
            # Enable ANSI colors on Windows Cmd/PowerShell
            os.system('color')
        asyncio.run(cli_monitor())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Telemetry link terminated by user.{Colors.RESET}")
