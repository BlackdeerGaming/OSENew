import React, { useState, useRef } from "react";
import { Building2, Search, Plus, ListFilter, FileEdit, Trash2, ShieldAlert, Save, Mail, Phone, Globe, MapPin, X, Scissors, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";
import ViewHeader from "../ui/ViewHeader";

const locationData = {
  "Colombia": ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"],
  "México": ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"],
  "España": ["Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria", "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunidad Valenciana", "Extremadura", "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja"],
  "Argentina": ["Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"]
};

function CropModal({ src, onConfirm, onCancel }) {
  const [sel, setSel] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const clampedPos = (e) => {
    const imgRect = imgRef.current.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(imgRect.left - cRect.left, Math.min(e.clientX - cRect.left, imgRect.right  - cRect.left)),
      y: Math.max(imgRect.top  - cRect.top,  Math.min(e.clientY - cRect.top,  imgRect.bottom - cRect.top)),
    };
  };

  const onMouseDown = (e) => { e.preventDefault(); const p = clampedPos(e); setStart(p); setSel({ x: p.x, y: p.y, w: 0, h: 0 }); setDragging(true); };
  const onMouseMove = (e) => { if (!dragging || !start) return; const p = clampedPos(e); setSel({ x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }); };
  const onMouseUp   = () => setDragging(false);

  const handleConfirm = () => {
    if (!sel || sel.w < 5 || sel.h < 5) return;
    const imgEl  = imgRef.current;
    const imgRect = imgEl.getBoundingClientRect();
    const cRect   = containerRef.current.getBoundingClientRect();
    const offX = imgRect.left - cRect.left;
    const offY = imgRect.top  - cRect.top;
    const scaleX = imgEl.naturalWidth  / imgRect.width;
    const scaleY = imgEl.naturalHeight / imgRect.height;
    const natX = Math.max(0, Math.round((sel.x - offX) * scaleX));
    const natY = Math.max(0, Math.round((sel.y - offY) * scaleY));
    const natW = Math.min(imgEl.naturalWidth  - natX, Math.round(sel.w * scaleX));
    const natH = Math.min(imgEl.naturalHeight - natY, Math.round(sel.h * scaleY));
    const canvas = document.createElement('canvas');
    canvas.width = natW; canvas.height = natH;
    canvas.getContext('2d').drawImage(imgEl, natX, natY, natW, natH, 0, 0, natW, natH);
    onConfirm(canvas.toDataURL('image/png'), natW, natH);
  };

  const hasSel = sel && sel.w > 5 && sel.h > 5;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-[15px]">Recortar Logo</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Haz clic y arrastra para seleccionar el área que deseas conservar.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative flex items-center justify-center bg-slate-100 select-none p-4"
          style={{ minHeight: 180, maxHeight: 420, cursor: 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <img
            ref={imgRef}
            src={src}
            draggable={false}
            style={{ maxWidth: '100%', maxHeight: 380, display: 'block', userSelect: 'none', pointerEvents: 'none' }}
            alt="Logo"
          />
          {hasSel && (
            <div style={{
              position: 'absolute', left: sel.x, top: sel.y, width: sel.w, height: sel.h,
              border: '2px solid #3b82f6',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {hasSel && (
          <div className="px-6 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 text-center">
            Área seleccionada: <span className="font-semibold text-slate-700">{Math.round(sel.w)} × {Math.round(sel.h)} px (pantalla)</span>
          </div>
        )}

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasSel}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
          >
            <Scissors className="h-4 w-4" /> Aplicar Recorte
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EntitiesView({ entities, setEntities, currentUser }) {
  const [view, setView] = useState("list"); // 'list', 'create', 'edit'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState(null);

  const [formData, setFormData] = useState({
    tipoEntidad: "Persona Jurídica",
    clasificacion: "Privada",
    razonSocial: "",
    sector: "Nacional",
    tipoDocumento: "NIT",
    numeroDocumento: "",
    dv: "",
    ciiu: "",
    pais: "Colombia",
    departamento: "",
    ciudad: "",
    direccion: "",
    telefono: "",
    celular: "",
    correo: "",
    nombreContacto: "",
    tipoEjecutor: "Entidad Pública",
    tamanoEmpresa: "Pequeña Empresa",
    entidadOrganizacional: false,
    proyectos: false,
    numDependencias: "",
    numProyectos: "",
    paginaWeb: "",
    logoUrl: "",
    estado: "Activo",
    maxUsuarios: 10,
    maxDependencias: 20,
    maxProyectos: 5,
  });

  const [logoPreview, setLogoPreview] = useState(null);
  const [logoOriginalDataUrl, setLogoOriginalDataUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [logoWarning, setLogoWarning] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [errors, setErrors] = useState({});

  const uploadDataUrl = async (dataUrl, filename = 'logo.png') => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    const file = new File([u8arr], filename, { type: mime });
    setIsUploading(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/entities/upload-logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser?.token}` },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, logoUrl: data.url, logoKey: data.key || "" }));
        setLogoWarning(prev => ({ ...prev, msg: (prev?.msg || "") + " ✓ Subida exitosa." }));
      } else {
        const err = await res.json().catch(() => ({}));
        setLogoWarning({ type: "error", msg: `Error al subir el logo: ${err.detail || res.status}. El logo no se guardará.` });
        setLogoPreview(null); // limpiar preview para que el usuario sepa que falló
      }
    } catch (err) {
      console.error("Logo upload failed", err);
      setLogoWarning({ type: "error", msg: "Error de conexión al subir el logo." });
      setLogoPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleResize = async () => {
    if (!logoOriginalDataUrl) return;
    const dataUrl = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 300, MAX_H = 150;
        const scale = Math.min(MAX_W / img.width, MAX_H / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = MAX_W; canvas.height = MAX_H;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, MAX_W, MAX_H);
        ctx.drawImage(img, (MAX_W - w) / 2, (MAX_H - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = logoOriginalDataUrl;
    });
    setLogoPreview(dataUrl);
    setLogoWarning({ type: 'ok', msg: 'Logo ajustado a 300 × 150 px con relleno blanco. Se mostrará correctamente en el TRD.' });
    await uploadDataUrl(dataUrl, `logo_resized_${Date.now()}.png`);
  };

  const handleCropConfirm = async (dataUrl, w, h) => {
    setShowCropModal(false);
    setLogoPreview(dataUrl);
    const ratio = w / h;
    if (h < 52) {
      setLogoWarning({ type: 'error', msg: `Recorte muy pequeño (${w}×${h} px). Se verá pixelado en el TRD.` });
    } else if (ratio > 4) {
      setLogoWarning({ type: 'warn', msg: `Recorte aún muy ancho (${w}×${h} px). Considera recortar de nuevo o usar Redimensionar.` });
    } else if (ratio < 0.5) {
      setLogoWarning({ type: 'warn', msg: `Recorte aún muy alto (${w}×${h} px). Considera recortar de nuevo o usar Redimensionar.` });
    } else {
      setLogoWarning({ type: 'ok', msg: `Recorte aplicado (${w}×${h} px). Se mostrará bien en el TRD.` });
    }
    await uploadDataUrl(dataUrl, `logo_cropped_${Date.now()}.png`);
  };

  const filteredEntities = (entities || []).map(e => {
    // Normalizar campos: priorizar camelCase si tiene contenido, sino usar snake_case
    const razonSocial = e.razonSocial || e.razon_social || "";
    const numeroDocumento = e.numeroDocumento || e.nit || "";
    const tipoEjecutor = e.tipoEjecutor || e.tipo_ejecutor || "Ejecutor No Def.";
    const correo = e.correo || e.email || "";
    const nombreContacto = e.nombreContacto || e.nombre_contacto || "";
    const logoUrl = e.logoUrl || e.logo_url || "";
    const sector = e.sector || "";
    
    return {
      ...e,
      razonSocial,
      numeroDocumento,
      tipoEjecutor,
      correo,
      nombreContacto,
      logoUrl,
      sector
    };
  }).filter(e => {
    const term = (searchQuery || "").toLowerCase();
    const razonSocial = e.razonSocial.toLowerCase();
    const nit = e.numeroDocumento.toString();
    return razonSocial.includes(term) || nit.includes(term);
  });

  const handleEdit = (ent) => {
    setSelectedEntity(ent);
    setFormData({
      ...ent,
      razonSocial: ent.razonSocial,
      numeroDocumento: ent.numeroDocumento,
      nombreContacto: ent.nombreContacto,
      correo: ent.correo,
      sector: ent.sector || "Nacional",
      tipoEjecutor: ent.tipoEjecutor,
      tamanoEmpresa: ent.tamanoEmpresa,
      entidadOrganizacional: !!ent.entidadOrganizacional,
      proyectos: !!ent.proyectos,
      numDependencias: ent.numDependencias,
      numProyectos: ent.numProyectos,
      celular: ent.celular || "",
      paginaWeb: ent.paginaWeb,
      dv: ent.dv || "",
      logoUrl: ent.logoUrl || "",
      logoKey: ent.logoKey || "",   // preservar clave S3 para refrescar URL
      pais: ent.pais || "Colombia",
      departamento: ent.departamento || "",
    });
    setLogoPreview(ent.logoUrl || null);  // mostrar logo actual en el preview
    setLogoOriginalDataUrl(null);
    setLogoWarning(null);
    setShowCropModal(false);
    setErrors({});
    setView("edit");
  };

  const handleDelete = (id) => {
    if (confirm("¿Estás seguro de eliminar esta entidad de forma permanente?")) {
      fetch(`${API_BASE_URL}/entities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentUser?.token}` }
      }).then(res => {
        if (res.ok) {
          setEntities(entities.filter(a => a.id !== id));
        } else {
          alert("Error al eliminar la entidad.");
        }
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.razonSocial.trim()) newErrors.razonSocial = "Obligatorio";
    if (!formData.numeroDocumento.trim()) newErrors.numeroDocumento = "Obligatorio";
    if (!formData.nombreContacto.trim()) newErrors.nombreContacto = "Obligatorio";
    if (!formData.sector) newErrors.sector = "Obligatorio";
    if (!formData.tipoEjecutor) newErrors.tipoEjecutor = "Obligatorio";
    if (!formData.tamanoEmpresa) newErrors.tamanoEmpresa = "Obligatorio";
    if (!formData.pais) newErrors.pais = "Obligatorio";
    if (!formData.departamento) newErrors.departamento = "Obligatorio";
    
    if (!formData.correo.trim()) {
      newErrors.correo = "Obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) {
      newErrors.correo = "Formato inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      setLogoPreview(dataUrl);
      setLogoOriginalDataUrl(dataUrl);
      const img = new Image();
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        const ratio = w / h;
        if (h < 52) {
          setLogoWarning({ type: "error", msg: `Imagen muy pequeña (${w}×${h} px). Se verá pixelada en el TRD — usa al menos 150×150 px.` });
        } else if (ratio > 4) {
          setLogoWarning({ type: "warn", msg: `Logo muy ancho (${w}×${h} px, proporción ${ratio.toFixed(1)}:1). Puede desbordarse en la celda del TRD.` });
        } else if (ratio < 0.5) {
          setLogoWarning({ type: "warn", msg: `Logo muy alto (${w}×${h} px). Se mostrará muy angosto en el TRD (celda de 52 px de altura).` });
        } else {
          setLogoWarning({ type: "ok", msg: `Tamaño correcto (${w}×${h} px). Se mostrará bien en el TRD.` });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/entities/upload-logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser?.token}` },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, logoUrl: data.url, logoKey: data.key || "" }));
      }
    } catch (err) {
      console.error("Logo upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!validate()) return;
    const method = view === "create" ? 'POST' : 'PUT';
    const url = view === "create" ? `${API_BASE_URL}/entities` : `${API_BASE_URL}/entities/${selectedEntity.id}`;

    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser?.token}`
      },
      body: JSON.stringify(formData)
    }).then(async res => {
      if (res.ok) {
        const saved = await res.json();
        if (view === "create") {
          setEntities([...entities, { ...formData, id: saved.id }]);
        } else {
          setEntities(entities.map(e => (e.id === selectedEntity.id ? { ...e, ...formData } : e)));
        }
        setView("list");
      } else {
        let msg = "Error al guardar la entidad.";
        try {
          const errData = await res.json();
          msg = errData.detail || errData.message || msg;
        } catch (_) {}
        alert(`Error (${res.status}): ${msg}`);
      }
    }).catch(err => {
      console.error(err);
      alert("Error de conexión al servidor.");
    });
  };

  if (view === "list") {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <ViewHeader
          icon={Building2}
          title="Directorio de Entidades"
          subtitle="Gestión global de organizaciones y clientes"
          actions={
            <button
              onClick={() => {
                setFormData({
                  tipoEntidad: "Persona Jurídica", clasificacion: "Privada", razonSocial: "", sector: "Nacional",
                  tipoDocumento: "NIT", numeroDocumento: "", dv: "", ciiu: "",
                  pais: "Colombia", departamento: "", ciudad: "", direccion: "",
                  telefono: "", celular: "", correo: "", nombreContacto: "", paginaWeb: "",
                  tipoEjecutor: "Entidad Pública", tamanoEmpresa: "Pequeña Empresa",
                  entidadOrganizacional: false, proyectos: false, numDependencias: "", numProyectos: "",
                  logoUrl: "", estado: "Activo",
                  maxUsuarios: 10, maxDependencias: 20, maxProyectos: 5,
                });
                setLogoPreview(null);
                setLogoWarning(null);
                setErrors({});
                setView("create");
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-semibold rounded-md hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" /> Nueva Entidad
            </button>
          }
        />

        <div className="flex-1 overflow-auto p-5 md:p-7 space-y-6">
          <div className="flex items-center gap-3 bg-card p-1.5 rounded-lg border border-border max-w-2xl">
            <Search className="ml-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o NIT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-9 bg-transparent border-none text-[13px] focus:ring-0 outline-none"
            />
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-[11px] font-bold uppercase hover:text-foreground transition-all">
              <ListFilter className="h-3.5 w-3.5" /> Filtrar
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-[10px] font-bold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-3 w-16">Logo</th>
                  <th className="px-6 py-3">Organización</th>
                  <th className="px-6 py-3">Identificación</th>
                  <th className="px-6 py-3">Contacto</th>
                  <th className="px-6 py-3">Sector</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEntities.map(ent => (
                  <tr key={ent.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      {ent.logoUrl ? (
                        <img src={ent.logoUrl} className="h-8 w-8 rounded-md border border-border object-contain p-0.5 bg-white shadow-sm" />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] uppercase">
                          {ent.razonSocial?.slice(0, 2) || "EN"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-foreground block leading-tight">{ent.razonSocial || "Entidad Sin Nombre"}</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">{ent.tipoEjecutor}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[11px] bg-secondary/80 px-1.5 py-0.5 rounded border border-border">
                        {ent.numeroDocumento} {ent.dv && `-${ent.dv}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <div className="font-medium text-foreground">{ent.nombreContacto}</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]"><Mail className="h-3 w-3" /> {ent.correo}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-[12px]">
                      {ent.sector}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                         "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                         ent.estado === "Activo" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                       )}>
                        {ent.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button onClick={() => handleEdit(ent)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-primary/8 hover:text-primary transition-all"><FileEdit className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(ent.id)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-destructive/60 hover:bg-destructive/8 hover:text-destructive transition-all"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader
        icon={view === "create" ? Plus : FileEdit}
        title={view === "create" ? "Nueva Entidad" : "Editar Entidad"}
        subtitle="Configura los parámetros corporativos y límites de acceso"
        onBack={() => setView("list")}
      />
      <div className="flex-1 overflow-auto p-5 md:p-7">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
          
          {/* Core Data (Información Legal) - FIRST */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3">
              <ShieldAlert className="h-4 w-4 text-primary" /> Información Legal
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Razón Social *</label>
              <input value={formData.razonSocial} onChange={e=>setFormData({...formData, razonSocial: e.target.value})} className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.razonSocial ? "border-destructive/50" : "border-input focus:ring-1 focus:ring-ring")} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Tipo Entidad</label>
                <select value={formData.tipoEntidad} onChange={e=>setFormData({...formData, tipoEntidad: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] outline-none">
                  <option>Persona Jurídica</option>
                  <option>Persona Natural</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Clasificación</label>
                <select value={formData.clasificacion} onChange={e=>setFormData({...formData, clasificacion: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] outline-none">
                  <option>Pública</option>
                  <option>Privada</option>
                  <option>Mixta</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">CIIU</label>
                <input value={formData.ciiu} onChange={e=>setFormData({...formData, ciiu: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Doc.</label>
                <select value={formData.tipoDocumento} onChange={e=>setFormData({...formData, tipoDocumento: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] outline-none">
                  <option>NIT</option>
                  <option>CC</option>
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Número *</label>
                <div className="flex gap-2">
                  <input value={formData.numeroDocumento} onChange={e=>setFormData({...formData, numeroDocumento: e.target.value})} className={cn("flex-1 h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.numeroDocumento ? "border-destructive/50" : "border-input")} />
                  <input placeholder="DV" value={formData.dv} onChange={e=>setFormData({...formData, dv: e.target.value})} className="w-12 h-9 bg-background border border-input rounded-md text-[13px] text-center" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Nombre de Contacto *</label>
              <input value={formData.nombreContacto} onChange={e=>setFormData({...formData, nombreContacto: e.target.value})} className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.nombreContacto ? "border-destructive/50" : "border-input")} />
            </div>
          </div>

          {/* Contact & Location - SECOND */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3"><MapPin className="h-4 w-4 text-primary" /> Contacto y Ubicación</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">País *</label>
                <select 
                  value={formData.pais} 
                  onChange={(e) => setFormData({...formData, pais: e.target.value, departamento: ""})} 
                  className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.pais ? "border-destructive/50" : "border-input")}
                >
                  <option value="">Seleccione...</option>
                  {Object.keys(locationData).map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Departamento *</label>
                <select 
                  value={formData.departamento} 
                  onChange={(e) => setFormData({...formData, departamento: e.target.value})} 
                  className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.departamento ? "border-destructive/50" : "border-input")}
                  disabled={!formData.pais || !locationData[formData.pais]}
                >
                  <option value="">Seleccione...</option>
                  {formData.pais && locationData[formData.pais] && locationData[formData.pais].map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Ciudad</label>
                <input value={formData.ciudad} onChange={e=>setFormData({...formData, ciudad: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Dirección</label>
                <input value={formData.direccion} onChange={e=>setFormData({...formData, direccion: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Correo *</label>
                <input type="email" value={formData.correo} onChange={e=>setFormData({...formData, correo: e.target.value})} className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px]", errors.correo ? "border-destructive/50" : "border-input")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Teléfono</label>
                <input value={formData.celular} onChange={e=>setFormData({...formData, celular: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Sitio Web</label>
              <input value={formData.paginaWeb} onChange={e=>setFormData({...formData, paginaWeb: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" placeholder="https://" />
            </div>
          </div>

          {/* Logo & Identity (THIRD, spans 2 rows to fit nicely on the right) */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-5 lg:row-span-2">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="h-4 w-4 text-primary" /> Identidad Visual
            </h3>
            
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative group">
                <div className="h-32 w-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary/30 transition-all group-hover:border-primary/50">
                  {logoPreview || formData.logoUrl ? (
                    <img src={logoPreview || formData.logoUrl} className="h-full w-full object-contain p-2" />
                  ) : (
                    <Building2 className="h-12 w-12 text-muted-foreground/30" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-all">
                  <Plus className="h-4 w-4" />
                  <input type="file" className="hidden" onChange={handleLogoChange} accept="image/*" />
                </label>
              </div>
              <div className="w-full space-y-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">Carga el logo oficial de la entidad (PNG, JPG o SVG)</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Tamaño recomendado: <span className="font-semibold text-slate-500">300 × 150 px</span> · Proporción ideal: <span className="font-semibold text-slate-500">1:1 a 3:1</span><br />
                  El logo se muestra a <span className="font-semibold text-slate-500">52 px de alto</span> en la cabecera del TRD
                </p>
                {logoWarning && (
                  <div className={`mt-1 rounded-lg px-3 py-2 text-[10px] font-medium leading-snug text-left
                    ${logoWarning.type === 'ok'    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
                    ${logoWarning.type === 'warn'  ? 'bg-amber-50  text-amber-700  border border-amber-200'  : ''}
                    ${logoWarning.type === 'error' ? 'bg-red-50    text-red-700    border border-red-200'    : ''}
                  `}>
                    <div className="flex items-start gap-1.5">
                      <span className="mt-px text-base leading-none">
                        {logoWarning.type === 'ok' ? '✓' : logoWarning.type === 'warn' ? '⚠' : '✕'}
                      </span>
                      <span>{logoWarning.msg}</span>
                    </div>
                    {logoWarning.type === 'warn' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={handleResize}
                          disabled={isUploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50"
                        >
                          <Minimize2 className="h-3 w-3" /> Redimensionar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCropModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 border border-amber-400 text-[10px] font-bold rounded-md hover:bg-amber-50 transition-colors"
                        >
                          <Scissors className="h-3 w-3" /> Recortar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Sector *</label>
                <select 
                  value={formData.sector} 
                  onChange={e=>setFormData({...formData, sector: e.target.value})} 
                  className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.sector ? "border-destructive/50" : "border-input")}
                >
                  <option>Distrital</option>
                  <option>Municipal</option>
                  <option>Departamental</option>
                  <option>Regional</option>
                  <option>Nacional</option>
                  <option>Internacional</option>
                  <option>Personal</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Tipo de Ejecutor *</label>
                <select 
                  value={formData.tipoEjecutor} 
                  onChange={e=>setFormData({...formData, tipoEjecutor: e.target.value})} 
                  className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.tipoEjecutor ? "border-destructive/50" : "border-input")}
                >
                  <option>Entidad Pública</option>
                  <option>MPI</option>
                  <option>Empresa Gestión Documental</option>
                  <option>Bibliotecólogo / Archivistas</option>
                  <option>Entidad Privada</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Tamaño Empresa *</label>
                <select 
                  value={formData.tamanoEmpresa} 
                  onChange={e=>setFormData({...formData, tamanoEmpresa: e.target.value})} 
                  className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px] outline-none", errors.tamanoEmpresa ? "border-destructive/50" : "border-input")}
                >
                  <option>MicroEmpresa</option>
                  <option>Pequeña Empresa</option>
                  <option>Mediana Empresa</option>
                  <option>Gran Empresa</option>
                  <option>Entidad sin ánimo de lucro</option>
                  <option>Entidad pública</option>
                  <option>Entidad Organizacional</option>
                  <option>Proyectos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Operational Scope - FOURTH (below 1 and 2, spanning 2 columns) */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 lg:col-span-2">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3">
              <ListFilter className="h-4 w-4 text-primary" /> Alcance Operativo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div className="flex flex-col gap-3 justify-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" checked={formData.entidadOrganizacional} onChange={e=>setFormData({...formData, entidadOrganizacional: e.target.checked})} className="peer hidden" />
                    <div className="h-5 w-5 border-2 border-border rounded-md bg-background peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                    <Save className="h-3 w-3 absolute inset-1 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[13px] font-medium group-hover:text-primary transition-colors">Entidad Organizacional</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" checked={formData.proyectos} onChange={e=>setFormData({...formData, proyectos: e.target.checked})} className="peer hidden" />
                    <div className="h-5 w-5 border-2 border-border rounded-md bg-background peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                    <Save className="h-3 w-3 absolute inset-1 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[13px] font-medium group-hover:text-primary transition-colors">Proyectos</span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Nº Dependencias</label>
                <input placeholder="Ej: 30" value={formData.numDependencias} onChange={e=>setFormData({...formData, numDependencias: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Nº Proyectos</label>
                <input placeholder="Ej: 5" value={formData.numProyectos} onChange={e=>setFormData({...formData, numProyectos: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Nº Usuarios Entidad</label>
                <input placeholder="Ej: 10" value={formData.maxUsuarios} onChange={e=>setFormData({...formData, maxUsuarios: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Estado Licencia</label>
                <select value={formData.estado} onChange={e=>setFormData({...formData, estado: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] font-bold text-primary">
                  <option>Activo</option>
                  <option>Inactivo</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <div className="p-4 border-t border-border bg-card flex justify-end gap-3 shrink-0">
        <button onClick={() => setView("list")} className="px-5 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all">Cancelar</button>
        <button onClick={handleSave} disabled={isUploading} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50">
          <Save className="h-4 w-4" /> Guardar Organización
        </button>
      </div>

      {showCropModal && logoOriginalDataUrl && (
        <CropModal
          src={logoOriginalDataUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropModal(false)}
        />
      )}
    </div>
  );
}
