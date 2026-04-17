import os

def fix_file(path):
    replacements = {
        '\u274c': '[ERROR]', 
        '\u2705': '[OK]', 
        '\u26a0\ufe0f': '[WARN]', 
        '\U0001f916': '[AI]', 
        '\U0001f50d': '[FIND]', 
        '\u2753': '[QUERY]', 
        '\U0001f4e5': '[IN]', 
        '\U0001f4e4': '[OUT]', 
        '\U0001f4e1': '[DB]', 
        '\U0001f4ca': '[STATS]'
    }
    
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    try:
        with open(path, 'rb') as f:
            content = f.read().decode('utf-8', errors='ignore')
        
        for k, v in replacements.items():
            content = content.replace(k, v)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Successfully cleaned {path}")
    except Exception as e:
        print(f"Error cleaning {path}: {e}")

if __name__ == "__main__":
    fix_file('api/main.py')
