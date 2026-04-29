import boto3
import os
from boto3.dynamodb.conditions import Key
from typing import Dict, Any, List, Optional

class DynamoDBManager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
        self.single_table_name = os.getenv("DYNAMODB_TABLE_NAME")
        
        # Usar credenciales explícitas
        self.dynamodb = boto3.resource(
            "dynamodb", 
            region_name=self.region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
        )

    def get_table(self, table_name: str):
        # Mapeo de nombres lógicos a nombres reales en la base de datos
        mapping = {
            "dependencias": "dependencies",
            "trd_records": "trds",
            "RagDocuments": "rag_documents"
        }
        real_name = mapping.get(table_name, table_name)

        # Usamos el prefijo (ej: ose_users, ose_dependencies)
        full_name = f"{self.prefix}{real_name}"
            
        print(f" [DYNAMO] Accediendo a tabla: {full_name}")
        return self.dynamodb.Table(full_name)

    async def get_item(self, table: str, pk_value: str, sk_value: Optional[str] = None) -> Optional[Dict]:
        table_obj = self.get_table(table)
        key = {"PK": pk_value}
        if sk_value:
            key["SK"] = sk_value
        
        response = table_obj.get_item(Key=key)
        return response.get("Item")

    async def put_item(self, table: str, item: Dict[str, Any]):
        table_obj = self.get_table(table)
        return table_obj.put_item(Item=item)

    async def query_by_entity(self, table: str, entity_id: str, sk_prefix: Optional[str] = None) -> List[Dict]:
        table_obj = self.get_table(table)
        # En nuestro esquema, la Partition Key es PK = ENTITY#{entity_id}
        pk = entity_id if (entity_id.startswith("ENTITY#") or entity_id == "GLOBAL") else f"ENTITY#{entity_id}"
        key_condition = Key("PK").eq(pk)
        
        if sk_prefix:
            key_condition &= Key("SK").begins_with(sk_prefix)
            
        response = table_obj.query(
            KeyConditionExpression=key_condition
        )
        return response.get("Items", [])

    async def delete_item(self, table: str, pk_value: str, sk_value: Optional[str] = None):
        table_obj = self.get_table(table)
        key = {"PK": pk_value}
        if sk_value:
            key["SK"] = sk_value
        return table_obj.delete_item(Key=key)

    async def update_item(self, table: str, pk: str, sk: str, updates: Dict[str, Any]):
        table_obj = self.get_table(table)
        update_expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates.keys())
        attr_names = {f"#{k}": k for k in updates.keys()}
        attr_values = {f":{k}": v for k, v in updates.items()}
        
        return table_obj.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ReturnValues="UPDATED_NEW"
        )

    async def scan_table(self, table_name: str) -> List[Dict]:
        table_obj = self.get_table(table_name)
        response = table_obj.scan()
        return response.get("Items", [])

db = DynamoDBManager()
