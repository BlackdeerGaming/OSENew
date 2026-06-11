"""Seed dependency_count and storage_used_bytes for all entities from live DynamoDB."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv()
import boto3, urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from boto3.dynamodb.conditions import Key

PREFIX = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
REGION = os.getenv("AWS_REGION", "us-east-2")
dynamo = boto3.resource("dynamodb", region_name=REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"), verify=False)

def tbl(name): return dynamo.Table(f"{PREFIX}{name}")

entities = tbl("entities").scan().get("Items", [])
print(f"Found {len(entities)} entities\n")

for e in entities:
    pk = e["PK"]
    name = (e.get("razonSocial") or e.get("nombre") or pk)[:40]

    dep_resp = tbl("dependencies").query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("DEP#"))
    dep_count = dep_resp["Count"]

    rag_resp = tbl("rag_documents").query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("UPLOAD#"))
    stor_bytes = sum(
        int(i.get("file_size_bytes") or (i.get("metadata") or {}).get("file_size_bytes") or 0)
        for i in rag_resp.get("Items", []))

    tbl("entities").update_item(
        Key={"PK": pk, "SK": "METADATA"},
        UpdateExpression="SET #dc = :dc, #sb = :sb",
        ExpressionAttributeNames={"#dc": "dependency_count", "#sb": "storage_used_bytes"},
        ExpressionAttributeValues={":dc": dep_count, ":sb": stor_bytes},
    )
    print(f"  [{name}]  deps={dep_count}  storage={stor_bytes} B")

print("\nAll entity counters seeded.")
