import os
import boto3
from dotenv import load_dotenv

load_dotenv()

region = os.getenv("AWS_REGION", "us-east-1")
prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "ose_")

dynamodb = boto3.resource(
    "dynamodb", 
    region_name=region,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)

table_name = f"{prefix}rag_documents"
table = dynamodb.Table(table_name)

print(f"Scanning table: {table_name}")
response = table.scan()
items = response.get('Items', [])

for item in items:
    pk = item.get('PK')
    sk = item.get('SK')
    meta = item.get('metadata', {})
    status = meta.get('status')
    source = meta.get('source')
    print(f"PK: {pk} | SK: {sk} | Status: {status} | Source: {source}")
