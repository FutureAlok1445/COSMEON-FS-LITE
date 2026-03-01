import os
import re

directory = r"c:\py project sem 4\New folder (2)\cosmeon-fs-lite\frontend\src"

patterns = [
    (re.compile(r"['\"]http://localhost:9000"), '`http://${window.location.hostname}:9000'),
    (re.compile(r"['\"]ws://localhost:9000"), '`ws://${window.location.hostname}:9000'),
    (re.compile(r"localhost:9000['\"]"), ':9000`'),
    (re.compile(r"http://\$:9000"), 'http://${window.location.hostname}:9000'),
    (re.compile(r"ws://\$:9000"), 'ws://${window.location.hostname}:9000'),
    (re.compile(r":9000['\"]"), ':9000`'),
]

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".jsx", ".js")):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for pattern, subst in patterns:
                new_content = pattern.sub(subst, new_content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {filepath}")
