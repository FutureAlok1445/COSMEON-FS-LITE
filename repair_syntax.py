import os
import re

directory = r"c:\py project sem 4\New folder (2)\cosmeon-fs-lite\frontend\src"

def fix_quote_mismatch(content):
    # Fix instances where a template literal starts with ` and ends with ' or "
    # Example: `http://${window.location.hostname}:9000/api/nodes'
    # Pattern: Match ` then some text then a single or double quote at the end of what looks like a URL
    
    # More specific: find `http://${window.location.hostname}:9000...' and replace ' with `
    content = re.sub(r"(`http://\$\{window\.location\.hostname\}:9000/[^'\"]+)['\"]", r"\1`", content)
    content = re.sub(r"(`ws://\$\{window\.location\.hostname\}:9000/[^'\"]+)['\"]", r"\1`", content)
    
    # Also handle the logic from the previous script which might have left trailing quotes
    # fetch(`http://${window.location.hostname}:9000/something')
    content = re.sub(r"(`[^`]*):9000([^`]*)['\"]", r"\1:9000\2`", content)
    
    # Ensure no back-to-back backticks if the regex was over-eager
    content = content.replace("``", "`")
    
    return content

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".jsx", ".js")):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = fix_quote_mismatch(content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Repaired: {filepath}")
