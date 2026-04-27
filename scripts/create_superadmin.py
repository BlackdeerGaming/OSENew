import boto3
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def create_superadmin():
    region = os.getenv("AWS_REGION", "us-east-2")
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
    table_prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
    
    email = "ivandchaves@gmail.com"
    password = "OseIAAdmin2024!"
    
    cognito = boto3.client("cognito-idp", region_name=region)
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(f"{table_prefix}users")

    print(f"[*] Iniciando creación de SuperAdmin: {email}")

    try:
        # 1. Crear usuario en Cognito
        print(f" [+] Creando usuario en Cognito User Pool {user_pool_id}...")
        response = cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'email_verified', 'Value': 'true'}
            ],
            MessageAction='SUPPRESS' # No enviar correo de bienvenida
        )
        user_sub = response['User']['Username']
        print(f" [OK] Usuario creado en Cognito (Sub: {user_sub})")

        # 2. Establecer contraseña permanente
        print(" [+] Estableciendo contraseña permanente...")
        cognito.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=email,
            Password=password,
            Permanent=True
        )
        print(" [OK] Contraseña establecida.")

        # 3. Crear registro en DynamoDB
        print(f" [+] Creando registro en tabla {table_prefix}users...")
        user_item = {
            'PK': f"USER#{user_sub}",
            'SK': "METADATA",
            'user_id': user_sub,
            'email': email,
            'role': 'superadmin',
            'status': 'active',
            'created_at': datetime.now().isoformat(),
            'entity_id': 'SYSTEM' # Superadmins globales no pertenecen a una entidad específica o son del sistema
        }
        
        table.put_item(Item=user_item)
        print(" [OK] Registro en DynamoDB completado.")
        
        print("\n" + "="*40)
        print(" SUPERADMIN CREADO EXITOSAMENTE")
        print("="*40)
        print(f" Email: {email}")
        print(f" Password: {password}")
        print("="*40)

    except cognito.exceptions.UsernameExistsException:
        print(f" [!] El usuario {email} ya existe en Cognito.")
    except Exception as e:
        print(f" [ERR] Error durante la creación: {e}")

if __name__ == "__main__":
    create_superadmin()
