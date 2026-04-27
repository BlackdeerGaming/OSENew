import boto3
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def create_ose_tables():
    region = os.getenv("AWS_REGION", "us-east-1")
    prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    client = boto3.client('dynamodb', region_name=region)

    # Definición de tablas base
    tables_to_create = [
        "entities",
        "users",
        "chat_sessions",
        "trds",
        "dependencies",
        "series",
        "subseries",
        "activity_logs",
        "rag_documents"
    ]

    for table_name in tables_to_create:
        full_name = f"{prefix}{table_name}"
        print(f"[*] Intentando crear tabla: {full_name}...")
        
        # Estructura básica: PK (Partition Key) y SK (Sort Key)
        attribute_definitions = [
            {'AttributeName': 'PK', 'AttributeType': 'S'},
            {'AttributeName': 'SK', 'AttributeType': 'S'}
        ]
        key_schema = [
            {'AttributeName': 'PK', 'KeyType': 'HASH'},
            {'AttributeName': 'SK', 'KeyType': 'RANGE'}
        ]

        # Agregar entity_id para GSI si no es la tabla de entities principal
        gsi = []
        if table_name != "entities":
            attribute_definitions.append({'AttributeName': 'entity_id', 'AttributeType': 'S'})
            gsi = [{
                'IndexName': 'entity_id-index',
                'KeySchema': [
                    {'AttributeName': 'entity_id', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }]

        create_params = {
            'TableName': full_name,
            'KeySchema': key_schema,
            'AttributeDefinitions': attribute_definitions,
            'BillingMode': 'PAY_PER_REQUEST'
        }
        
        if gsi:
            create_params['GlobalSecondaryIndexes'] = gsi

        try:
            dynamodb.create_table(**create_params)
            print(f" [OK] Tabla {full_name} creada exitosamente.")
        except client.exceptions.ResourceInUseException:
            print(f" [!] La tabla {full_name} ya existe. Saltando...")
        except Exception as e:
            print(f" [ERR] Error al crear {full_name}: {e}")


if __name__ == "__main__":
    create_ose_tables()
