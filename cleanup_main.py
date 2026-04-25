import os
import re

path = 'api/main.py'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Eliminar caracteres no-ASCII
content = re.sub(r'[^\x00-\x7F]+', '', content)

# 2. Reemplazar TODAS las comillas triples por comentarios o comillas simples
# Buscamos bloques """ ... """ y los convertimos
content = content.replace('"""', '###')

# 3. Limpieza de duplicados al final (si el archivo es muy grande)
lines = content.splitlines()
if len(lines) > 2000:
    lines = lines[:1600]

with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("Archivo api/main.py saneado AGRESIVAMENTE.")
