# OSE IA - Plataforma de Gestión Documental Inteligente (v1.0 Alfa)

OSE IA es una solución de vanguardia diseñada para automatizar y optimizar la gestión de **Tablas de Retención Documental (TRD)** mediante Inteligencia Artificial. La plataforma permite a las organizaciones centralizar su normativa archivística, procesar documentos mediante visión artificial y consultar información técnica a través de un asistente inteligente.

---

## 🌟 Funcionalidades Principales

### 1. Dashboard Ejecutivo
*   **Métricas en Tiempo Real**: Visualización de documentos totales, vencidos y consumo de tokens IA.
*   **Refresco Manual**: Botón de sincronización paralela para actualizar datos sin recargar la página.
*   **Historial de Actividad**: Registro detallado de acciones realizadas en el sistema con marcas de tiempo normalizadas.
*   **Recomendaciones Inteligentes**: Sugerencias automáticas basadas en el estado de los documentos y TRD.

### 2. Gestión de TRD (Datos Estructurados)
*   **Jerarquía Archivística**: Administración completa de Dependencias, Series y Subseries.
*   **Editor Dinámico**: Formulario integrado para la creación y edición de registros con permisos basados en roles.
*   **Exportación Oficial**: Generación de reportes PDF de alta fidelidad (estándar DANE).
*   **Sincronización Robusta**: Sistema de guardado con detección de cambios y refresco automático de estado.

### 3. Biblioteca RAG (Gestión de Documentos)
*   **Importación por Visión IA**: Carga de archivos PDF e imágenes con extracción automática de tablas y metadatos.
*   **OCR Avanzado**: Procesamiento de documentos escaneados para convertirlos en datos estructurados.
*   **Búsqueda Semántica**: Localización de documentos por contexto y contenido, no solo por nombre.

### 4. OSE Copilot (Asistente IA)
*   **Chat Especializado**: Asistente entrenado en la normativa archivística de la entidad.
*   **Generador Documental**: Ayuda en la redacción y estructuración de nuevas series y procedimientos.
*   **Análisis de Vencimientos**: Detección proactiva de documentos que requieren disposición final (eliminación o transferencia).

### 5. Administración y Seguridad
*   **Control de Acceso (RBAC)**: Roles diferenciados (Superadmin, Administrador, Usuario de Consulta).
*   **Multi-Entidad**: Soporte para múltiples organizaciones con aislamiento de datos.
*   **Sistema de Invitaciones**: Registro controlado de nuevos usuarios mediante correo electrónico.

---

## 🛠️ Arquitectura Técnica

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS / Vanilla CSS Premium
- **Icons**: Lucide React
- **Estado**: React Hooks (Custom hooks para TRD y RAG)

### Backend
- **Framework**: FastAPI (Python)
- **Base de Datos**: Supabase (PostgreSQL)
- **IA/ML**: 
  - **OpenAI/Google Gemini**: Procesamiento de lenguaje natural.
  - **ChromaDB**: Almacenamiento de vectores para RAG.
  - **LangChain**: Orquestación de flujos de IA.

---

## 🚀 Instalación y Despliegue

### Requisitos
- Node.js 18+
- Python 3.12+
- Cuenta en Supabase

### Pasos Iniciales
1. Clonar el repositorio.
2. Instalar dependencias del frontend: `npm install`.
3. Instalar dependencias del backend: `pip install -r api/requirements.txt`.
4. Configurar variables de entorno en `.env`.

---

## 📄 Licencia y Créditos
Este software ha sido desarrollado por el equipo de **Blackdeer Gaming / OSE IA**. Todos los derechos reservados.

**Versión:** 1.0 Alfa
**Estado:** Funcional / En Despliegue (Vercel)
