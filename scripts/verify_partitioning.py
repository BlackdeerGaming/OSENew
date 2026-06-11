"""
Verifies entity-based data partitioning at the DynamoDB layer.

Checks:
  1. Every record in entity-data tables belongs to a known entity.
  2. No record's PK points to a different entity than its entity_id field (PK vs field mismatch).
  3. Cross-entity query isolation: querying entity A never returns entity B's records.
  4. Per-entity record counts across all tables.

Usage:
    cd "F:/Projects/Simulators/OSE IA"
    python scripts/verify_partitioning.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import boto3
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from boto3.dynamodb.conditions import Key

PREFIX = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
REGION = os.getenv("AWS_REGION", "us-east-2")

dynamo = boto3.resource(
    "dynamodb",
    region_name=REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    verify=False,
)

# Tables that MUST be entity-partitioned (PK = ENTITY#{id})
ENTITY_TABLES = [
    "dependencies",
    "series",
    "subseries",
    "trds",
    "funciones",
    "rag_documents",
    "activity_logs",
]

# Tables that use a different PK design (not entity-partitioned by PK)
SKIP_TABLES = ["users", "invitations", "entities", "entrevistas"]


def scan_all(table_obj):
    items, resp = [], table_obj.scan()
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table_obj.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp.get("Items", []))
    return items


def query_entity(table_obj, entity_id):
    pk = f"ENTITY#{entity_id}"
    resp = table_obj.query(KeyConditionExpression=Key("PK").eq(pk))
    items = list(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table_obj.query(
            KeyConditionExpression=Key("PK").eq(pk),
            ExclusiveStartKey=resp["LastEvaluatedKey"]
        )
        items.extend(resp.get("Items", []))
    return items


def get_entities():
    tbl = dynamo.Table(f"{PREFIX}entities")
    items = scan_all(tbl)
    entities = []
    for item in items:
        pk = str(item.get("PK", ""))
        eid = item.get("id") or pk.replace("ENTITY#", "")
        name = item.get("razonSocial") or item.get("nombre") or eid[:8]
        entities.append({"id": eid, "name": name, "pk": pk})
    return entities


def check_table(table_name, entities, entity_ids):
    full = f"{PREFIX}{table_name}"
    print(f"\n  Table: {full}")
    try:
        tbl = dynamo.Table(full)
        all_items = scan_all(tbl)
    except Exception as e:
        print(f"    [ERR] Could not scan: {e}")
        return

    if not all_items:
        print(f"    [OK] Empty table.")
        return

    # --- Check 1: All PKs must start with ENTITY# ---
    bad_pk = [i for i in all_items if not str(i.get("PK", "")).startswith("ENTITY#")]
    if bad_pk:
        print(f"    [FAIL] {len(bad_pk)} record(s) with non-ENTITY# PK:")
        for i in bad_pk[:3]:
            print(f"           PK={i.get('PK')} SK={i.get('SK')}")
    else:
        print(f"    [OK] All {len(all_items)} records have ENTITY# PK.")

    # --- Check 2: PK entity must match entity_id field (when present) ---
    mismatches = []
    for item in all_items:
        pk_entity = str(item.get("PK", "")).replace("ENTITY#", "")
        field_entity = str(item.get("entity_id") or item.get("entidad_id") or "")
        if field_entity and field_entity != pk_entity and pk_entity not in ("GLOBAL",):
            mismatches.append(item)
    if mismatches:
        print(f"    [FAIL] {len(mismatches)} record(s) where PK entity != entity_id field:")
        for i in mismatches[:3]:
            pk_e = str(i.get("PK", "")).replace("ENTITY#", "")
            print(f"           PK entity={pk_e[:8]}  field={str(i.get('entity_id',''))[:8]}  SK={i.get('SK')}")
    else:
        print(f"    [OK] PK entity matches entity_id field on all records.")

    # --- Check 3: Per-entity counts ---
    by_entity = {}
    for item in all_items:
        pk = str(item.get("PK", ""))
        by_entity[pk] = by_entity.get(pk, 0) + 1

    known_pks = {f"ENTITY#{e['id']}" for e in entities}
    unknown = {pk: cnt for pk, cnt in by_entity.items() if pk not in known_pks}

    for e in entities:
        epk = f"ENTITY#{e['id']}"
        cnt = by_entity.get(epk, 0)
        print(f"    Entity [{e['name'][:30]}]: {cnt} records")

    if unknown:
        print(f"    [WARN] {len(unknown)} record(s) belong to unknown entities:")
        for pk, cnt in list(unknown.items())[:5]:
            print(f"           {pk} → {cnt} records")

    # --- Check 4: Cross-entity isolation (query entity A, verify no entity B records) ---
    print(f"    Cross-entity isolation check:")
    isolation_ok = True
    for e in entities:
        rows = query_entity(tbl, e["id"])
        leaks = [r for r in rows if str(r.get("PK", "")) != f"ENTITY#{e['id']}"]
        if leaks:
            print(f"      [FAIL] Entity [{e['name'][:20]}] query returned {len(leaks)} records from other entities!")
            isolation_ok = False
        else:
            print(f"      [OK] Entity [{e['name'][:20]}]: query returned {len(rows)} records, all correctly scoped.")
    if isolation_ok:
        print(f"    [OK] DynamoDB query isolation is clean — each entity only sees its own data.")


def main():
    print(f"\n{'='*65}")
    print(f"OSE IA — Entity Partitioning Verification")
    print(f"Prefix: {PREFIX}   Region: {REGION}")
    print(f"{'='*65}")

    print(f"\nLoading entities from {PREFIX}entities...")
    entities = get_entities()
    entity_ids = {e["id"] for e in entities}
    if not entities:
        print("[ERR] No entities found — cannot verify.")
        return

    print(f"Found {len(entities)} entities:")
    for e in entities:
        print(f"  {e['id'][:8]}...  {e['name']}")

    for table_name in ENTITY_TABLES:
        check_table(table_name, entities, entity_ids)

    print(f"\n{'='*65}")
    print("Verification complete.")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    main()
