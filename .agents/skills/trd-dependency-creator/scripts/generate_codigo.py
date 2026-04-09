import sys

def generate_codigo(parent_code, existing_sibling_codes):
    """
    Genera el siguiente código jerárquico basado en el código del padre
    usando un sistema de prefijos (CódigoMadre + Secuencial).
    """
    # Si no hay padre, es la dependencia principal
    if not parent_code or parent_code.lower() == 'none' or parent_code == '':
        return "100"

    parent_str = str(parent_code)
    
    # Extraer los sufijos numéricos de los hermanos que ya siguen este patrón
    suffixes = []
    for c in existing_sibling_codes:
        c_str = str(c)
        if c_str.startswith(parent_str) and len(c_str) > len(parent_str):
            suffix_part = c_str[len(parent_str):]
            if suffix_part.isdigit():
                suffixes.append(int(suffix_part))
    
    # El siguiente número es el máximo encontrado + 1, o simplemente 1
    next_num = max(suffixes) + 1 if suffixes else 1
    
    return f"{parent_str}{next_num}"

if __name__ == "__main__":
    # Uso: python generate_codigo.py <parent_code> <sibling_code1> <sibling_code2> ...
    if len(sys.argv) < 2:
        # Casos de prueba
        print("Test 1: Sin padre ->", generate_codigo(None, []))
        print("Test 2: Padre 100, sin hermanos ->", generate_codigo("100", []))
        print("Test 3: Padre 100, hermano 200 ->", generate_codigo("100", ["200"]))
        print("Test 4: Padre 200, sin hermanos ->", generate_codigo("200", []))
        print("Test 5: Padre 200, hermano 201 ->", generate_codigo("200", ["201"]))
    else:
        p_code = sys.argv[1]
        s_codes = sys.argv[2:]
        print(generate_codigo(p_code, s_codes))
