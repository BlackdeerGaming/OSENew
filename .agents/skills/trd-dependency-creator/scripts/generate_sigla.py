import sys
import re

def generate_sigla(nombre):
    # Preposiciones y conectores comunes en español que debemos saltar
    # si hay más de una palabra.
    skip_words = {'de', 'la', 'el', 'y', 'del', 'los', 'las', 'por', 'a', 'con', 'en'}
    
    # Limpiar el nombre: quitar caracteres especiales y espacios extra
    nombre = re.sub(r'[^\w\s]', '', nombre)
    words = nombre.split()
    
    if not words:
        return ""
    
    if len(words) == 1:
        # Una palabra: las dos primeras letras
        sigla = words[0][:2]
    else:
        # Varias palabras: primera letra de cada palabra "significativa"
        sigla_parts = []
        for word in words:
            if word.lower() not in skip_words or len(words) <= 2:
                # Si solo hay 2 palabras, mantenemos ambas aunque una sea 'de' (ej: "Oficina de")
                # pero si hay más, saltamos las preposiciones.
                sigla_parts.append(word[0])
        
        # Si por alguna razón saltamos todo (poco probable), usamos todas las palabras
        if not sigla_parts:
            sigla = "".join([w[0] for w in words])
        else:
            sigla = "".join(sigla_parts)
            
    return sigla.upper()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        nombre_input = " ".join(sys.argv[1:])
        print(generate_sigla(nombre_input))
    else:
        # Casos de prueba
        test_cases = [
            "Tesorería",
            "Jurídica",
            "Archivo Central",
            "Grupo de Gestión Documental",
            "Talento Humano",
            "Oficina Jurídica",
            "Secretaría General"
        ]
        for tc in test_cases:
            print(f"{tc} -> {generate_sigla(tc)}")
