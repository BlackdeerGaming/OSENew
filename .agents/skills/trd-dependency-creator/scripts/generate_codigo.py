import sys

def generate_codigo(parent_code, existing_sibling_codes):
    """
    Genera el siguiente código jerárquico basado en el código del padre
    y los códigos de las dependencias hermanas ya existentes.
    """
    # Si no hay padre, es la dependencia principal
    if not parent_code or parent_code.lower() == 'none' or parent_code == '':
        return "100"

    try:
        parent_val = int(parent_code)
    except ValueError:
        # Si el código del padre no es numérico, no podemos seguir la lógica
        return "ERROR_PARENT_NON_NUMERIC"

    # Convertir hermanos a enteros para cálculos
    sibling_vals = []
    for c in existing_sibling_codes:
        try:
            sibling_vals.append(int(c))
        except ValueError:
            continue

    if parent_val == 100:
        # Nivel 1 (hijas de 100): Inician en 200 y crecen de 10 en 10
        if not sibling_vals:
            return "200"
        return str(max(sibling_vals) + 10)
    
    # Nivel 2+ (hijas de dependencias nivel 1 o superior):
    # La regla dice "crecerá de 10 en 10 para hijas directas", 
    # pero el ejemplo de Nivel 1 ya usa el salto de 100 a 200.
    # Si seguimos la lógica de bloques:
    # Nivel 1: incrementos de 10 (200, 210, 220...)
    # Nivel 2: incrementos de 1 (201, 202, 203...)
    
    if not sibling_vals:
        return str(parent_val + 1)
    
    return str(max(sibling_vals) + 1)

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
