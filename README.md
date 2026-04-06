# OSE Copilot - Sistema Gestor de TRD & IA

Este proyecto es una plataforma avanzada para la gestión de **Tablas de Retención Documental (TRD)** y la organización administrativa. Combina una interfaz de usuario moderna y reactiva con un asistente de Inteligencia Artificial capaz de procesar documentos técnicos y automatizar tareas de gestión documental.

---

## 🚀 Arquitectura del Proyecto

El sistema está dividido en dos grandes módulos que trabajan en conjunto:

### 1. Backend (FastAPI) - `/backend`
Un servidor Python de alto rendimiento que actúa como el "cerebro" del sistema:
- **Asistente RAG:** Procesa archivos PDF, extrae texto e imágenes con modelos de visión, y los indexa en una base vectorial (**ChromaDB**).
- **Orquestación de IA:** Utiliza **LangChain** y **OpenRouter** para razonar sobre la jerarquía organizacional (Dependencias, Series, Subseries).
- **Servicio de Notificaciones:** Mock de envío de correos electrónicos para la activación de cuentas.

### 2. Frontend (React + Vite) - `/ose-trd-builder`
Una Single Page Application (SPA) enfocada en la experiencia de usuario SaaS:
- **Diseño Premium:** Estética moderna, modo oscuro por defecto y micro-animaciones fluidas.
- **Gestión por Pasos:** Formularios tipo *stepper* para la creación de usuarios y entidades.
- **Seguridad:** Flujo de invitación/activación de cuentas con políticas de contraseñas robustas.

---

## ⚙️ Configuración e Instalación

### Requisitos Previos
- **Python 3.10+**
- **Node.js 18+**
- **Referencia API:** Una clave de [OpenRouter](https://openrouter.ai/).

### 1. Configurar el Backend
```bash
cd backend
# Crear entorno virtual
python -m venv .venv
source .venv/bin/activate  # O .venv\Scripts\activate en Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables
cp ../.env.example .env
# Edita .env con tu OPENROUTER_API_KEY
```

### 2. Configurar el Frontend
```bash
cd ose-trd-builder
npm install
```

---

## 🛠️ Ejecución

### Iniciar Backend
```bash
cd backend
uvicorn main:app --reload
```
*El servidor estará disponible en: [http://localhost:8000](http://localhost:8000)*

### Iniciar Frontend
```bash
cd ose-trd-builder
npm run dev
```
*La aplicación estará disponible en: [http://localhost:5173](http://localhost:5173)*

---

## 🛡️ Acceso Inicial (Modo Desarrollo)
Al iniciar por primera vez, utiliza el usuario maestro:
- **Usuario:** `superadmin`
- **Contraseña:** `admin`

*(Una vez dentro, puedes crear nuevos usuarios reales que recibirán un correo de activación vía la consola de FastAPI).*

---

## 📄 Licencia
Este proyecto es propiedad de **OSE IA** y su uso está restringido a fines autorizados por la organización.
