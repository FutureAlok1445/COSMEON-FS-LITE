import os
import re

directory = r"c:\py project sem 4\New folder (2)\cosmeon-fs-lite\frontend\src"

def safe_connectivity_patch(content):
    # 1. First, replace any localhost:8000 with the dynamic logic
    content = content.replace("localhost:8000", "${window.location.hostname}:9000")
    content = content.replace("localhost:9000", "${window.location.hostname}:9000") # Just in case

    # 2. Now find any strings that contain window.location.hostname but are NOT in backticks
    # Pattern: 'http://${window.location.hostname}:9000/...' or "http://${window.location.hostname}:9000/..."
    
    # Replace single quoted URLs
    content = re.sub(r"'((?:http|ws)://\$\{window\.location\.hostname\}:9000[^']*)'", r"`\1`", content)
    # Replace double quoted URLs
    content = re.sub(r"\"((?:http|ws)://\$\{window\.location\.hostname\}:9000[^\"]*)\"", r"`\1`", content)
    
    # 3. Final cleanup: ensure no double backticks
    content = content.replace("``", "`")
    
    return content

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".jsx", ".js")):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = safe_connectivity_patch(content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Patched: {filepath}")
