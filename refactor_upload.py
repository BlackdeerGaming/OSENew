import re

with open('api/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Add BackgroundTasks
text = text.replace(
    "from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter", 
    "from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks"
)

# Replace the analyze_trd logic
old_block = """@router.post("/analyze-trd")
async def analyze_trd(file: UploadFile = File(...)):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    
    print(f"🔍 Analizando TRD: {file.filename}")
    content = await file.read()"""

new_block = """
async def process_ocr_task(doc_id: str, content: bytes, filename: str):
    print(f"⚙️ Iniciando Background Task OCR para: {filename}")
    extracted_text = ""
    ocr_engaged = False
    
    try:
        fitz_doc = fitz.open(stream=content)
        pages_to_process = min(len(fitz_doc), 15)
        for i in range(pages_to_process):
            extracted_text += f"\\n--- PÁGINA {i+1} ---\\n" + fitz_doc[i].get_text()
        fitz_doc.close()
    except Exception as e:
        print(f"❌ Error leyendo archivo con Fitz: {e}")
        supabase_client.table("rag_documents").update({
            "metadata": {"status": "error", "message": f"Error leyendo el archivo: {str(e)}"}
        }).eq("id", doc_id).execute()
        return

    if len(extracted_text.strip()) < 50:
        print("⚠️ Texto insuficiente extraído.")
    
    try:
        # Usar el LLM para analizar la estructura
        messages_llm = [
            SystemMessage(content=TRD_ANALYZE_PROMPT.format(text=extracted_text))
        ]
        
        # --- INTERNAL OCR SKILL FALLBACK ---
        try:
            fitz_doc = fitz.open(stream=content)
            if len(fitz_doc) > 0:
                print("🛠️ OCR_SKILL: Activando 'trd-internal-ocr' debido a documento escaneado/legibilidad baja.")
                ocr_engaged = True
                page = fitz_doc[0]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_data = base64.b64encode(pix.tobytes("png")).decode("utf-8")
                
                messages_llm.append(HumanMessage(content=[
                    {"type": "text", "text": "Estás operando como el motor 'trd-internal-ocr'. Aquí tienes la imagen real de la TRD. Por favor, identifica las filas y columnas para extraer las dependencias, series y subseries. Genera el JSON."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_data}"}}
                ]))
            fitz_doc.close()
        except Exception as vision_err:
            print(f"⚠️ OCR_SKILL falló al procesar imagen: {vision_err}")

        response = llm.invoke(messages_llm)
        content_ai = response.content.strip()
        print(f"🤖 IA Response received ({len(content_ai)} chars)")

        # --- PERSISTENCIA EN RAG_DOCUMENTS ---
        try:
            # En la tabla RAG normal para consultar
            doc_metadata = {
                "source": filename,
                "type": "trd_upload",
                "is_trd_internal": True,
                "extracted_at": str(datetime.now()),
                "pages": pages_to_process
            }
            
            embedding_vector = None
            if embeddings:
                try:
                    embedding_vector = embeddings.embed_query(extracted_text)
                except Exception as emb_err:
                    print(f"⚠️ No se pudo generar embedding: {emb_err}")

            rag_payload = {
                "content": extracted_text,
                "metadata": doc_metadata,
                "embedding": embedding_vector
            }
            supabase_client.table("rag_documents").insert(rag_payload).execute()
        except Exception as rag_err:
            print(f"⚠️ Error guardando en RAG: {rag_err}")
        
        # Extraer JSON
        json_match = re.search(r'(\\{.*\\})', content_ai, re.DOTALL)
        parsed_data = {}
        if json_match:
            try:
                parsed_data = json.loads(json_match.group(1))
                if not parsed_data.get("actions") or len(parsed_data["actions"]) == 0:
                    parsed_data["message"] = f"La IA analizó pero no generó acciones. Respuesta bruta: {content_ai[:1000]}"
            except Exception as json_err:
                print(f"❌ Error parseando JSON: {json_err}")
                
        if not parsed_data:
            parsed_data = {
                "message": f"No se pudo detectar el formato JSON.",
                "actions": [],
                "raw": content_ai
            }

        parsed_data["ocr_engaged"] = ocr_engaged
        
        # --- UPDATE IMPORT SESSION ---
        try:
            # Obtener metadata actual para no pisarla
            row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            if row.data:
                curr_meta = row.data[0]["metadata"]
                curr_meta.update({
                    "status": "reviewing",
                    "actions": parsed_data.get("actions", []),
                    "message": parsed_data.get("message", ""),
                    "ocr_engaged": ocr_engaged,
                    "pages": pages_to_process
                })
                supabase_client.table("rag_documents").update({
                    "metadata": curr_meta
                }).eq("id", doc_id).execute()
                print("✅ Session updated a reviewing.")
        except Exception as upd_err:
            print(f"❌ Error updateting session: {upd_err}")

    except Exception as e:
        print(f"❌ Error en process_ocr_task: {e}")
        try:
            row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            if row.data:
                curr_meta = row.data[0]["metadata"]
                curr_meta["status"] = "error"
                curr_meta["message"] = str(e)
                supabase_client.table("rag_documents").update({"metadata": curr_meta}).eq("id", doc_id).execute()
        except:
            pass


@router.post("/analyze-trd")
async def analyze_trd(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    
    print(f"🔍 Recibiendo TRD para analizar: {file.filename}")
    content = await file.read()"""

text = text.replace(old_block, new_block)


# Now remove the old process logic that was inside analyze_trd
# Everything between "extracted_text = ''" and "return parsed_data"

start_idx = text.find('    extracted_text = ""\n    ocr_engaged = False\n\n    \n    try:\n        fitz_doc = fitz.open(stream=content)')
if start_idx == -1:
    print("Could not find start index")
    print(text.find("extracted_text = \"\""))

end_idx = text.find('        return parsed_data\n        \n    except Exception as e:')
if end_idx == -1:
    print("Could not find end index")

if start_idx != -1 and end_idx != -1:
    # Let's replace the whole body from start_idx to end_idx with our new short logic
    old_body = text[start_idx:end_idx]
    
    new_body = """    
    # Subir a Supabase Storage y crear sesión inicial
    file_url = ""
    try:
        bucket = "trd-uploads"
        filename_clean = f"{datetime.now().timestamp()}_{file.filename.replace(' ', '_')}"
        supabase_client.storage.from_(bucket).upload(filename_clean, content)
        file_url = supabase_client.storage.from_(bucket).get_public_url(filename_clean)
    except Exception as e:
        print(f"⚠️ Error subiendo a storage: {e}")
        
    doc_metadata = {
        "source": file.filename,
        "type": "trd_import_session",
        "is_trd_internal": True,
        "status": "analyzing",
        "file_url": file_url,
        "extracted_at": str(datetime.now()),
        "actions": []
    }
    
    try:
        rag_payload = {"content": "Import Session Snapshot", "metadata": doc_metadata}
        inserted = supabase_client.table("rag_documents").insert(rag_payload).execute()
        if inserted.data and len(inserted.data) > 0:
            doc_id = inserted.data[0].get("id")
            # Lanzamos BackgroundTask
            background_tasks.add_task(process_ocr_task, doc_id, content, file.filename)
            return {"import_id": doc_id, "status": "analyzing"}
        else:
            raise HTTPException(status_code=500, detail="No se pudo crear la sesión RAG")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""
    
    text = text[:start_idx] + new_body + text[end_idx:]

with open('api/main.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("api/main.py updated successfully.")
