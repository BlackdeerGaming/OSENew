import sys
path = 'api/main.py'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_put_endpoint = r'''
@router.put("/rag-documents/{doc_id}")
async def update_rag_document_status(doc_id: str, payload: dict, user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    
    # Obtener metadata actual
    res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
    if not res.data: raise HTTPException(404, "Documento no encontrado")
    
    meta = res.data[0]["metadata"]
    new_status = payload.get("status", meta.get("status"))
    meta["status"] = new_status
    
    # Si se marca como éxito, cambiamos el tipo de sesión temporal a carga persistente
    if new_status == "success":
        meta["type"] = "trd_upload"
        # Opcional: Podríamos disparar otras lógicas de limpieza de sesiones aquí
        
    supabase_client.table("rag_documents").update({"metadata": meta}).eq("id", doc_id).execute()
    return {"status": "success", "new_status": new_status}
'''

# Identify where to insert the PUT endpoint (after the GET rag-documents)
insert_idx = -1
for i, line in enumerate(lines):
    if line.startswith('async def delete_rag_document'):
        insert_idx = i
        break

if insert_idx != -1:
    lines.insert(insert_idx, new_put_endpoint + '\n')
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully added PUT /rag-documents/{id} to api/main.py")
else:
    print("Failed to find insertion marker for PUT endpoint")
    sys.exit(1)
