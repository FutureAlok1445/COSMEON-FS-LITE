import asyncio
import os
from interactive_cli import CosmeonCLI
from textual.widgets import Input

async def test_all_features(pilot):
    app = pilot.app
    print("Starting CLI API integration test sequence...")
    await asyncio.sleep(2)  # Wait for mount
    
    app.query_one("TabbedContent").active = "tab-chaos"
    await asyncio.sleep(1)
    # 1. Test Chaos Ops
    chaos_endpoints = ["solar_flare", "bit_rot", "partition", "overload", "imbalance", "restore"]
    for endpoint in chaos_endpoints:
        print(f"Triggering Chaos: {endpoint}")
        app.run_worker(app.trigger_chaos(endpoint))
        await asyncio.sleep(2)
    
    # 2. Test Payload Ops Upload
    app.query_one("TabbedContent").active = "tab-payload"
    await asyncio.sleep(1)
    
    print("Testing UPLOAD...")
    test_filepath = os.path.abspath("cli_test_payload.bin")
    with open(test_filepath, "wb") as f:
        f.write(os.urandom(1024 * 50)) # 50 KB dummy file
    
    app.run_worker(app.upload_file(test_filepath))
    
    # 3. Test Payload Ops Download
    file_id = getattr(app, 'last_uploaded_id', None)
    attempts = 0
    while not file_id and attempts < 10:
        await asyncio.sleep(1)
        file_id = getattr(app, 'last_uploaded_id', None)
        attempts += 1

    print(f"Obtained file_id: {file_id}")
    
    if file_id:
        print("Testing DOWNLOAD...")
        app.run_worker(app.download_file(file_id))
        await asyncio.sleep(5)
        
        # 4. Test Payload Ops Erase
        print("Testing ERASE...")
        app.run_worker(app.delete_file(file_id))
        await asyncio.sleep(3)
    else:
        print("FAILED to get a file_id from upload!")
    
    # 5. Test Manual Rebalance
    print("Testing MANUAL REBALANCE...")
    app.run_worker(app.trigger_rebalance())
    await asyncio.sleep(3)
    
    # 6. Test Survivability Fetch
    app.query_one("TabbedContent").active = "tab-metrics"
    await asyncio.sleep(1)
    print("Testing SURVIVABILITY fetch...")
    text_content = str(app.query_one("#surv_text").render())
    if "GLOBAL HEALTH" in text_content:
        print("Survivability Dashboard Populated Successfully!")
    else:
        print("Survivability Dashboard Failed to Populate:", text_content)
    
    # Cleanup
    if os.path.exists(test_filepath):
        os.remove(test_filepath)
        
    print("Testing complete. Triggering shutdown.")
    await app.action_quit()

if __name__ == "__main__":
    app = CosmeonCLI()
    app.run(headless=True, auto_pilot=test_all_features)
