import sys

def generate_serie_codigo(dep_codigo, existing_serie_codigos):
    """
    Genera el siguiente código de serie basado en el código de la dependencia
    y los códigos de las series ya existentes para esa dependencia.
    Pattern: [dep_codigo]-[sequence] (e.g., 100-01)
    """
    if not dep_codigo:
        return "ERROR_MISSING_DEP_CODE"

    # Filtrar solo los códigos que pertenecen a esta dependencia y tienen el formato correcto
    sequences = []
    prefix = f"{dep_codigo}-"
    
    for code in existing_serie_codigos:
        if code.startswith(prefix):
            try:
                # Extraer la parte de la secuencia (ej: de 100-01 extrae 01)
                seq_part = code[len(prefix):]
                # Podría haber subseries o ruido, tomamos solo los primeros 2 dígitos si es posible
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
    return f"{dep_codigo}-{str(next_seq).zfill(2)}"

if __name__ == "__main__":
    # Uso: python generate_serie_codigo.py <dep_codigo> <existing_code1> <existing_code2> ...
    if len(sys.argv) < 2:
        # Casos de prueba
        print("Test 1: Dep 100, sin series ->", generate_serie_codigo("100", []))
        print("Test 2: Dep 100, con serie 100-01 ->", generate_serie_codigo("100", ["100-01"]))
        print("Test 3: Dep 200, con series 200-01, 200-02 ->", generate_serie_codigo("200", ["200-01", "200-02"]))
        print("Test 4: Dep 100, con serie 100-05 (salto) ->", generate_serie_codigo("100", ["100-05"]))
    else:
        d_code = sys.argv[1]
        e_codes = sys.argv[2:]
        print(generate_serie_codigo(d_code, e_codes))
