import boto3
import json
import os
from dotenv import load_dotenv

load_dotenv()

def update_iam_permissions():
    try:
        client = boto3.client('iam')
        user_name = 'ose-ia-backend'
        policy_name = 'FullDynamoDBAccess'
        
        policy_json = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "dynamodb:*",
                    "Resource": "*"
                }
            ]
        }
        
        print(f"[*] Intentando actualizar permisos para {user_name}...")
        client.put_user_policy(
            UserName=user_name,
            PolicyName=policy_name,
            PolicyDocument=json.dumps(policy_json)
        )
        print("[OK] Permisos actualizados exitosamente.")
    except Exception as e:
        print(f" [!] Error al actualizar permisos: {e}")

if __name__ == "__main__":
    update_iam_permissions()
