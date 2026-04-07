import sys
import json

TEMPLATES = {
    "alcaldia": {
        "name": "Alcaldía Municipal (Modelo Estándar)",
        "dependencies": [
            {
                "nombre": "Archivo Central",
                "codigo": "100",
                "sigla": "AC",
                "series": [
                    {
                        "nombre": "Comunicaciones Oficiales",
                        "subseries": ["Correspondencia Recibida", "Correspondencia Enviada"],
                        "retencion_gestion": 2,
                        "retencion_central": 10,
                        "disposicion": "Eliminación",
                        "ddhh": "No"
                    }
                ]
            },
            {
                "nombre": "Secretaría General",
                "codigo": "200",
                "sigla": "SG",
                "series": [
                    {
                        "nombre": "Actas",
                        "subseries": ["Actas de Consejo de Gobierno", "Actas de Comité Institucional"],
                        "retencion_gestion": 5,
                        "retencion_central": 20,
                        "disposicion": "Conservación total",
                        "ddhh": "No"
                    },
                    {
                        "nombre": "Resoluciones",
                        "subseries": ["Resoluciones de Carácter General", "Resoluciones de Carácter Particular"],
                        "retencion_gestion": 5,
                        "retencion_central": 20,
                        "disposicion": "Conservación total",
                        "ddhh": "No"
                    }
                ]
            },
            {
                "nombre": "Talento Humano",
                "codigo": "210",
                "sigla": "TH",
                "child_of": "200",
                "series": [
                    {
                        "nombre": "Historias Laborales",
                        "subseries": ["Historias Laborales Activas", "Historias Laborales Retirados"],
                        "retencion_gestion": 5,
                        "retencion_central": 80,
                        "disposicion": "Conservación total",
                        "ddhh": "No",
                        "tipos_documentales": ["Hoja de Vida", "Contrato de Trabajo", "Afiliaciones EPS/ARL", "Evaluaciones de Desempeño", "Actas de Posesión"]
                    },
                    {
                        "nombre": "Nómina",
                        "subseries": ["Nómina de Salarios", "Nómina de Prestaciones Sociales"],
                        "retencion_gestion": 2,
                        "retencion_central": 20,
                        "disposicion": "Selección",
                        "ddhh": "No",
                        "tipos_documentales": ["Planilla de Nómina", "Comprobantes de Pago", "Soportes de Novedades"]
                    }
                ]
            },
            {
                "nombre": "Oficina Jurídica",
                "codigo": "220",
                "sigla": "OJ",
                "child_of": "200",
                "series": [
                    {
                        "nombre": "Procesos Judiciales",
                        "subseries": ["Procesos Civiles", "Procesos Administrativos", "Acciones de Tutela"],
                        "retencion_gestion": 5,
                        "retencion_central": 15,
                        "disposicion": "Selección",
                        "ddhh": "Si",
                        "tipos_documentales": ["Demanda", "Notificación", "Contestación", "Auto de Inicio", "Sentencia"]
                    }
                ]
            }
        ]
    },
    "empresa": {
        "name": "Empresa Privada (Modelo Estándar)",
        "dependencies": [
            {
                "nombre": "Gerencia General",
                "codigo": "100",
                "sigla": "GG",
                "series": [
                    {
                        "nombre": "Actas de Asamblea",
                        "subseries": ["Actas Ordinarias", "Actas Extraordinarias"],
                        "retencion_gestion": 5,
                        "retencion_central": 20,
                        "disposicion": "Conservación total"
                    }
                ]
            },
            {
                "nombre": "Administración y Finanzas",
                "codigo": "200",
                "sigla": "AF",
                "series": [
                    {
                        "nombre": "Comprobantes de Contabilidad",
                        "subseries": ["Egresos", "Ingresos", "Notas de Contabilidad"],
                        "retencion_gestion": 2,
                        "retencion_central": 10,
                        "disposicion": "Eliminación"
                    }
                ]
            }
        ]
    }
}

def get_template(entity_type):
    return TEMPLATES.get(entity_type.lower(), TEMPLATES["empresa"])

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(get_template(sys.argv[1]), indent=2))
    else:
        print("Available templates: alcaldia, empresa")
