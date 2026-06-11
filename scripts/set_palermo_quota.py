"""
One-time script: configure quota on "Alcaldia Municipal de Palermo" (test entity)
and seed the dependency_count counter from live DynamoDB records.

Entity ID: 06354901-ba7d-4138-87b5-0d08f9fc9e13

Test settings:
  plan_name           = "Standard (Test)"
  quota_enabled       = True
  quota_type          = "both"
  dependency_limit    = 20
  storage_limit_bytes = 104857600   (100 MB)
  dependency_count    = recalculated from DEP# records
  storage_used_bytes  = recalculated from UPLOAD# records

Usage:
    cd "F:/Projects/Simulators/OSE IA"
    python scripts/set_palermo_quota.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import boto3
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from boto3.dynamodb.conditions import Key

PREFIX  = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
REGION  = os.getenv("AWS_REGION", "us-east-2")
ENTITY_ID = "06354901-ba7d-4138-87b5-0d08f9fc9e13"  # Alcaldia de Palermo
ENTITY_PK = f"ENTITY#{ENTITY_ID}"

dynamo = boto3.resource(
    "dynamodb",
    region_name=REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    verify=False,
)

def get_table(name):
    return dynamo.Table(f"{PREFIX}{name}")

def count_deps():
    tbl = get_table("dependencies")
    resp = tbl.query(KeyConditionExpression=Key("PK").eq(ENTITY_PK) & Key("SK").begins_with("DEP#"))
    return resp["Count"]

def sum_storage():
    tbl = get_table("rag_documents")
    resp = tbl.query(KeyConditionExpression=Key("PK").eq(ENTITY_PK) & Key("SK").begins_with("UPLOAD#"))
    total = 0
    for item in resp.get("Items", []):
        size = item.get("file_size_bytes") or (item.get("metadata") or {}).get("file_size_bytes") or 0
        total += int(size)
    return total

def main():
    dep_count  = count_deps()
    stor_bytes = sum_storage()

    quota_fields = {
        "plan_name":            "Standard (Test)",
        "quota_enabled":        True,
        "quota_type":           "both",
        "dependency_limit":     20,
        "storage_limit_bytes":  104_857_600,   # 100 MB
        "dependency_count":     dep_count,
        "storage_used_bytes":   stor_bytes,
    }

    print(f"\n{'='*55}")
    print(f"Setting quota on Alcaldia de Palermo ({ENTITY_ID[:8]}...)")
    print(f"  dependency_count    = {dep_count} (live count)")
    print(f"  dependency_limit    = 20")
    print(f"  storage_used_bytes  = {stor_bytes}")
    print(f"  storage_limit_bytes = 104857600 (100 MB)")
    print(f"{'='*55}")

    tbl = get_table("entities")

    # Build SET expression
    updates = {f"#{k}": v for k, v in quota_fields.items()}
    expr_names  = {f"#{k}": k for k in quota_fields}
    expr_values = {f":{k}": v for k, v in quota_fields.items()}
    update_expr = "SET " + ", ".join(f"#{k} = :{k}" for k in quota_fields)

    tbl.update_item(
        Key={"PK": ENTITY_PK, "SK": "METADATA"},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )

    print("Quota configured successfully.")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    main()
