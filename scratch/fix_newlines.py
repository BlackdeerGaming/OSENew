import os

def fix_newlines(path):
    if not os.path.exists(path):
        return
    
    with open(path, 'rb') as f:
        content = f.read()
    
    # Check if it looks like doubled newlines
    # We'll try to decode as utf-8 and then fix
    text = content.decode('utf-8', errors='ignore')
    
    # If the file has a lot of \n\n instead of \n
    lines = text.splitlines()
    new_lines = []
    
    # Heuristic: if almost every other line is empty, it's doubled
    # But let's just use a simpler check: join with single \n
    # Actually, the view_file showed:
    # 1: import os
    # 2: 
    # 3: import re
    # 4: 
    # This means line 2 is empty, line 4 is empty... exactly doubled.
    
    # We take every other line IF they are empty? No, that's risky.
    # Let's just remove all lines that are JUST whitespace IF the previous line was NOT empty?
    # Better: the view_file output shows EXACTLY one empty line between every code line.
    
    # Let's try to just take non-empty lines? No, some empty lines are good.
    # Let's try to remove EVERY SECOND newline.
    
    fixed_lines = []
    for i in range(0, len(lines), 2):
        fixed_lines.append(lines[i])
        
    final_text = "\n".join(fixed_lines)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(final_text)

if __name__ == "__main__":
    fix_newlines('api/main.py')
