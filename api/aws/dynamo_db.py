import boto3
import os
from boto3.dynamodb.conditions import Key
from typing import Dict, Any, List, Optional

class DynamoDBManager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.dynamodb = boto3.resource("dynamodb", region_name=self.region)
        self.prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")

    def get_table(self, table_name: str):
        return self.dynamodb.Table(f"{self.prefix}{table_name}")

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
        key_condition = Key("entity_id").eq(entity_id)
        if sk_prefix:
            key_condition &= Key("SK").begins_with(sk_prefix)
            
        # Note: This assumes entity_id is a GSI or we are using a specific table design.
        # For a standard multi-tenant table, we use entity_id as the Partition Key.
        response = table_obj.query(
            KeyConditionExpression=Key("entity_id").eq(entity_id)
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
