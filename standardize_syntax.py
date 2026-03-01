import os
import re

directory = r"c:\py project sem 4\New folder (2)\cosmeon-fs-lite\frontend\src"

def final_standardization(content):
    # This script will find any string containing our window.location.hostname logic
    # and wrap it exactly in backticks, removing any extra surrounding quotes.
    
    # Match: ['"`] (http/ws)://${window.location.hostname}:9000 [any url chars] ['"`]
    # Replace with: `\2`
    
    new_content = re.sub(r"(['\"`])((?:http|ws)://\$\{window\.location\.hostname\}:9000[^'\"`]*)(['\"`])", r"`\2`", content)
    
    # Also fix the weird cases like console.error(`Failed to fetch nodes", err)
    # This one is tricky. Let's look for backtick followed by text followed by quote
    new_content = re.sub(r"(`[^`\"]+)\"", r"\1`", new_content)
    new_content = re.sub(r"(`[^`']+)'", r"\1`", new_content)
    
    # Cleanup double backticks
    new_content = new_content.replace("``", "`")
    
    return new_content

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".jsx", ".js")):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = final_standardization(content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Standardized: {filepath}")
