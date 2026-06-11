import boto3
import os
from boto3.dynamodb.conditions import Key
from typing import Dict, Any, List, Optional

class DynamoDBManager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")

        # Single-table name takes priority; fall back to prefix-based names if not set.
        self.single_table_name = os.getenv("DYNAMODB_TABLE_NAME")
        self.prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")

        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=self.region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
        )

    def get_table(self, table_name: str):
        # Apply known name aliases then prepend the configured prefix.
        # DYNAMODB_TABLE_NAME is stored for reference but each logical table
        # has its own physical table (ose_users, ose_entities, etc.).
        mapping = {
            "dependencias": "dependencies",
            "trd_records": "trds",
            "RagDocuments": "rag_documents"
        }
        real_name = mapping.get(table_name, table_name)
        full_name = f"{self.prefix}{real_name}"
        print(f" [DYNAMO] Tabla: {full_name}")
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
        try:
            result = table_obj.put_item(Item=item)
            print(f" [DYNAMO] put_item OK: {item.get('PK')}/{item.get('SK')}")
            return result
        except Exception as e:
            print(f" [DYNAMO] put_item FAILED: {item.get('PK')}/{item.get('SK')} → {e}")
            raise

    async def query_by_entity(self, table: str, entity_id: str, sk_prefix: Optional[str] = None) -> List[Dict]:
        table_obj = self.get_table(table)
        pk = entity_id if (entity_id.startswith("ENTITY#") or entity_id == "GLOBAL") else f"ENTITY#{entity_id}"
        key_condition = Key("PK").eq(pk)
        if sk_prefix:
            key_condition &= Key("SK").begins_with(sk_prefix)
        response = table_obj.query(KeyConditionExpression=key_condition)
        return response.get("Items", [])

    async def query_by_gsi(self, table: str, index_name: str, key_name: str, key_value: str,
                           sk_name: Optional[str] = None, sk_value: Optional[str] = None) -> List[Dict]:
        """Query a Global Secondary Index by partition key (and optional sort key)."""
        table_obj = self.get_table(table)
        key_condition = Key(key_name).eq(key_value)
        if sk_name and sk_value:
            key_condition &= Key(sk_name).eq(sk_value)
        kwargs = {
            "IndexName": index_name,
            "KeyConditionExpression": key_condition,
        }
        items: List[Dict] = []
        response = table_obj.query(**kwargs)
        items.extend(response.get("Items", []))
        while "LastEvaluatedKey" in response:
            response = table_obj.query(ExclusiveStartKey=response["LastEvaluatedKey"], **kwargs)
            items.extend(response.get("Items", []))
        return items

    async def delete_item(self, table: str, pk_value: str, sk_value: Optional[str] = None):
        table_obj = self.get_table(table)
        key = {"PK": pk_value}
        if sk_value:
            key["SK"] = sk_value
        return table_obj.delete_item(Key=key)

    async def update_item(self, table: str, pk: str, sk: str, updates: Dict[str, Any]):
        # Strip None values — DynamoDB SET expressions cannot accept NULL types
        # via the high-level resource API without explicit type declaration.
        clean = {k: v for k, v in updates.items() if v is not None}
        if not clean:
            print(f" [DYNAMO] update_item skipped (empty payload): {pk}/{sk}")
            return {}

        table_obj = self.get_table(table)
        update_expr = "SET " + ", ".join(f"#{k} = :{k}" for k in clean.keys())
        attr_names = {f"#{k}": k for k in clean.keys()}
        attr_values = {f":{k}": v for k, v in clean.items()}

        print(f" [DYNAMO] update_item: {pk}/{sk} → fields: {list(clean.keys())}")
        try:
            result = table_obj.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=attr_names,
                ExpressionAttributeValues=attr_values,
                ReturnValues="UPDATED_NEW"
            )
            print(f" [DYNAMO] update_item OK: {pk}/{sk}")
            return result
        except Exception as e:
            print(f" [DYNAMO] update_item FAILED: {pk}/{sk} → {e}")
            raise

    async def scan_table(self, table_name: str) -> List[Dict]:
        """Full scan with automatic pagination (DynamoDB returns ≤ 1 MB per page)."""
        table_obj = self.get_table(table_name)
        items: List[Dict] = []
        try:
            response = table_obj.scan()
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = table_obj.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                items.extend(response.get("Items", []))
        except Exception as e:
            print(f" [DYNAMO] scan_table FAILED on '{table_name}': {e}")
            raise
        return items

db = DynamoDBManager()
