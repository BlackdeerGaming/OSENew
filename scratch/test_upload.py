import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def upload_test():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    bucket = "trd-uploads"
    name = "test_upload_content_type.pdf"
    content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n"
    
    # Try different combinations of file_options
    print("Uploading with content-type...")
    supabase.storage.from_(bucket).upload(name, content, file_options={"content-type": "application/pdf"})
    
    # Check headers using public URL
    url = supabase.storage.from_(bucket).get_public_url(name)
    import httpx
    res = httpx.head(url)
    print(f"Header for content-type: {res.headers.get('content-type')}")
    
    # Clean up
    supabase.storage.from_(bucket).remove([name])

if __name__ == "__main__":
    upload_test()
