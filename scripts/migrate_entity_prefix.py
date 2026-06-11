"""
Migration: Fix records in ose_rag_documents and ose_activity_logs
that have a raw entity UUID as PK instead of ENTITY#{uuid}.

Target entity: Alcaldia de Palermo
Bad PK: 06354901-ba7d-4138-87b5-0d08f9fc9e13
Fixed PK: ENTITY#06354901-ba7d-4138-87b5-0d08f9fc9e13

DynamoDB does not allow PK updates — we delete the old item and put a new one.

Usage:
    cd "F:/Projects/Simulators/OSE IA"
    python scripts/migrate_entity_prefix.py

Pass --dry-run to preview without making changes.
"""
import os, sys, argparse
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import boto3
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

PREFIX    = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")
REGION    = os.getenv("AWS_REGION", "us-east-2")
BAD_UUID  = "06354901-ba7d-4138-87b5-0d08f9fc9e13"
FIXED_PK  = f"ENTITY#{BAD_UUID}"

dynamo = boto3.resource(
    "dynamodb",
    region_name=REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    verify=False,
)

TABLES_TO_MIGRATE = ["rag_documents", "activity_logs"]


def scan_bad_items(table_obj):
    items, resp = [], table_obj.scan()
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table_obj.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp.get("Items", []))
    return [i for i in items if str(i.get("PK", "")) == BAD_UUID]


KEY_ATTRS = {"PK", "SK"}  # All OSE tables use the same composite key


def migrate_table(table_name: str, dry_run: bool):
    full_name = f"{PREFIX}{table_name}"
    print(f"\n--- {full_name} ---")
    tbl = dynamo.Table(full_name)

    bad_items = scan_bad_items(tbl)
    print(f"  Found {len(bad_items)} records with bad PK '{BAD_UUID}'")

    if not bad_items:
        print("  Nothing to migrate.")
        return 0

    migrated = 0
    for item in bad_items:
        old_key = {k: item[k] for k in KEY_ATTRS if k in item}
        new_item = {**item, "PK": FIXED_PK}

        if dry_run:
            print(f"  [DRY RUN] Would migrate: PK={item['PK']} SK={item.get('SK')}")
        else:
            # Put new item first, then delete old — safe even if interrupted
            tbl.put_item(Item=new_item)
            tbl.delete_item(Key=old_key)
            print(f"  [DONE] Migrated: SK={item.get('SK')}")
        migrated += 1

    return migrated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no changes")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"OSE IA - Entity Prefix Migration")
    print(f"  Bad PK : {BAD_UUID}")
    print(f"  Fixed  : {FIXED_PK}")
    print(f"  Mode   : {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"{'='*60}")

    total = 0
    for t in TABLES_TO_MIGRATE:
        total += migrate_table(t, args.dry_run)

    print(f"\n{'='*60}")
    action = "Would migrate" if args.dry_run else "Migrated"
    print(f"  {action} {total} records total.")
    if args.dry_run:
        print("  Run without --dry-run to apply changes.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
