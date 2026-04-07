---
description: Iniciar el servidor backend y el frontend de OSE IA de manera local
---

Este workflow automatiza el encendido de los componentes del proyecto OSE IA.

### 1. Iniciar el Backend (FastAPI)
Abre una terminal nueva y ejecuta el siguiente comando para activar el entorno virtual e iniciar el servidor.

// turbo
```powershell
.\.venv\Scripts\activate; uvicorn api.main:app --reload --port 8000
```

### 2. Iniciar el Frontend (Vite)
Abre OTRA terminal (manteniendo abierta la anterior) y ejecuta:

// turbo
```powershell
npm run dev
```

### 3. Verificación
Una vez iniciados:
- **Backend:** [http://localhost:8000/api/](http://localhost:8000/api/)
- **Frontend:** [http://localhost:5173/](http://localhost:5173/) (o la URL que indique Vite)

---
> [!TIP]
> Si es la primera vez que ejecutas el proyecto, asegúrate de tener las dependencias instaladas con `pip install -r api/requirements.txt` y `npm install`.
