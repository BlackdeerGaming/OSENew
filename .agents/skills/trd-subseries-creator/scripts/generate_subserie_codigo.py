import sys

def generate_subserie_codigo(serie_codigo, existing_subserie_codigos):
    """
    Genera el siguiente código de subserie basado en el código de la serie
    y los códigos de las subseries ya existentes para esa serie.
    Pattern: [serie_codigo]-[sequence] (e.g., 100-01-01)
    """
    if not serie_codigo:
        return "ERROR_MISSING_SERIE_CODE"

    # Filtrar solo los códigos que pertenecen a esta serie y tienen el formato correcto
    sequences = []
    prefix = f"{serie_codigo}-"
    
    for code in existing_subserie_codigos:
        if code.startswith(prefix):
            try:
                # Extraer la parte de la secuencia (ej: de 100-01-01 extrae 01)
                seq_part = code[len(prefix):]
                # Tomamos los primeros 2 dígitos
                if len(seq_part) >= 2:
                    seq_val = int(seq_part[:2])
                    sequences.append(seq_val)
            except ValueError:
                continue

    if not sequences:
        next_seq = 1
    else:
        next_seq = max(sequences) + 1

    # Formatear la secuencia con ceros a la izquierda (01, 02, ...)
    return f"{serie_codigo}-{str(next_seq).zfill(2)}"

if __name__ == "__main__":
    # Uso: python generate_subserie_codigo.py <serie_codigo> <existing_code1> <existing_code2> ...
    if len(sys.argv) < 2:
        # Casos de prueba
        print("Test 1: Serie 100-01, sin subseries ->", generate_subserie_codigo("100-01", []))
        print("Test 2: Serie 100-01, con subserie 100-01-01 ->", generate_subserie_codigo("100-01", ["100-01-01"]))
        print("Test 3: Serie 200-05, con subseries 200-05-01, 200-05-02 ->", generate_subserie_codigo("200-05", ["200-05-01", "200-05-02"]))
    else:
        s_code = sys.argv[1]
        e_codes = sys.argv[2:]
        print(generate_subserie_codigo(s_code, e_codes))
