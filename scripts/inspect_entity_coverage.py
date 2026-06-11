"""
Run this script locally to inspect entity_id coverage across all DynamoDB tables
before deciding on data migration.

Usage:
    cd "F:/Projects/Simulators/OSE IA"
    python scripts/inspect_entity_coverage.py

Requirements: AWS credentials in environment (.env or system).
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import boto3
from boto3.dynamodb.conditions import Key

PREFIX = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
REGION = os.getenv("AWS_REGION", "us-east-2")

import ssl, urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from botocore.config import Config
import botocore
dynamo = boto3.resource(
    "dynamodb",
    region_name=REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    verify=False,
)

TABLES = [
    ("dependencias",  "dependencies"),
    ("series",        "series"),
    ("subseries",     "subseries"),
    ("trd_records",   "trds"),
    ("funciones",     "funciones"),
    ("entrevistas",   "entrevistas"),
    ("RagDocuments",  "rag_documents"),
    ("activity_logs", "activity_logs"),
    ("invitations",   "invitations"),
    ("users",         "users"),
    ("entities",      "entities"),
]

def scan_all(table_obj):
    items = []
    resp = table_obj.scan()
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table_obj.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp.get("Items", []))
    return items

print(f"\n{'='*60}")
print(f"OSE IA - Entity Coverage Inspection ({PREFIX})")
print(f"{'='*60}\n")

total_records = 0
total_missing = 0
migration_candidates = []

for logical, physical in TABLES:
    table_name = f"{PREFIX}{physical}"
    try:
        tbl = dynamo.Table(table_name)
        items = scan_all(tbl)
        valid, global_pk, invalid = [], [], []
        for item in items:
            pk = str(item.get("PK", ""))
            if pk.startswith("ENTITY#") and pk not in ("ENTITY#GLOBAL", "ENTITY#"):
                valid.append(item)
            elif pk in ("ENTITY#GLOBAL", "GLOBAL"):
                global_pk.append(item)
            else:
                invalid.append(item)

        status = "[OK]" if not invalid and not global_pk else ("[WARN]" if global_pk else "[ERR]")
        print(f"{status}  {table_name}")
        print(f"     Total: {len(items)} | Entity-scoped: {len(valid)} | GLOBAL: {len(global_pk)} | Missing: {len(invalid)}")

        if invalid:
            for item in invalid[:5]:
                print(f"     Missing entity: PK={item.get('PK')} SK={item.get('SK')}")
            if len(invalid) > 5:
                print(f"     ... and {len(invalid)-5} more")

        if global_pk:
            for item in global_pk[:3]:
                print(f"     GLOBAL PK: PK={item.get('PK')} SK={item.get('SK')}")

        total_records += len(items)
        total_missing += len(invalid)

        if invalid:
            migration_candidates.append({
                "table": table_name,
                "count": len(invalid),
                "samples": [{"PK": i.get("PK"), "SK": i.get("SK"), "id": i.get("id")} for i in invalid[:5]]
            })
        print()
    except Exception as e:
        print(f"[ERR]  {table_name}: ERROR - {e}\n")

print(f"{'='*60}")
print(f"SUMMARY")
print(f"  Total records scanned : {total_records}")
print(f"  Records missing entity: {total_missing}")
print(f"  Migration needed      : {'YES' if total_missing > 0 else 'NO - all records already entity-scoped'}")

if migration_candidates:
    print(f"\nMIGRATION CANDIDATES:")
    print(json.dumps(migration_candidates, indent=2, default=str))
print(f"{'='*60}\n")
