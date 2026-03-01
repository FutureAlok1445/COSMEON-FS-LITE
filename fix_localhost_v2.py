import os
import re

directory = r"c:\py project sem 4\New folder (2)\cosmeon-fs-lite\frontend\src"

# Broader replacement:
# 1. 'http://localhost:9000' -> `http://${window.location.hostname}:9000`
# 2. "http://localhost:9000" -> `http://${window.location.hostname}:9000`
# 3. `http://localhost:9000` -> `http://${window.location.hostname}:9000`

def replace_logic(content):
    # This will handle http/ws with any surrounding quote or already in backticks
    # It replaces 'localhost:9000' with '${window.location.hostname}:9000'
    # And ensures the whole string is inside backticks if it wasn't already.
    
    # First, handle plain strings: 'http://localhost:9000/...' or "http://localhost:9000/..."
    content = re.sub(r"(['\"])(((http|ws)://)localhost:9000(/[^'\"]*)?)(['\"])", 
                     r"`\3${window.location.hostname}:9000\5`", content)
    
    # Second, handle existing template literals: `http://localhost:9000/...`
    content = re.sub(r"localhost:9000", r"${window.location.hostname}:9000", content)
    
    # Clean up double ${window.location.hostname} if it happened
    content = content.replace("${window.location.hostname}:${window.location.hostname}", "${window.location.hostname}")
    
    return content

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".jsx", ".js")):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = replace_logic(content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {filepath}")
