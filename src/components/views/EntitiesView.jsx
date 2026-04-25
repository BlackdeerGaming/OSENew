import React, { useState } from "react";
import { Building2, Search, Plus, ListFilter, FileEdit, Trash2, ShieldAlert, Save, Mail, Phone, Globe, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";
import ViewHeader from "../ui/ViewHeader";

export default function EntitiesView({ entities, setEntities }) {
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
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});

  const filteredEntities = (entities || []).filter(e => {
    const term = (searchQuery || "").toLowerCase();
    const razonSocial = (e.razonSocial || "").toLowerCase();
    const nit = (e.numeroDocumento || "").toString();
    return razonSocial.includes(term) || nit.includes(term);
  });

  const handleEdit = (ent) => {
    setSelectedEntity(ent);
    setFormData({
      ...ent,
      sector: ent.sector || "Nacional",
      tipoEjecutor: ent.tipoEjecutor || "Entidad Pública",
      tamanoEmpresa: ent.tamanoEmpresa || "Pequeña Empresa",
      entidadOrganizacional: !!ent.entidadOrganizacional,
      proyectos: !!ent.proyectos,
      numDependencias: ent.num_dependencias || ent.numDependencias || "",
      numProyectos: ent.num_proyectos || ent.numProyectos || "",
      nombreContacto: ent.nombre_contacto || ent.nombreContacto || "",
      correo: ent.correo || ent.email || "",
      celular: ent.celular || "",
      paginaWeb: ent.pagina_web || ent.paginaWeb || "",
      dv: ent.dv || "",
      logoUrl: ent.logo_url || ent.logoUrl || "",
    });
    setLogoPreview(null);
    setErrors({});
    setView("edit");
  };

  const handleDelete = (id) => {
    if (confirm("¿Estás seguro de eliminar esta entidad de forma permanente?")) {
      fetch(`${API_BASE_URL}/entities/${id}`, {
        method: 'DELETE'
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
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);

    setIsUploading(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/entities/upload-logo`, { method: 'POST', body });
      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, logoUrl: data.url });
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
      headers: { 'Content-Type': 'application/json' },
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
        alert("Error al guardar la entidad.");
      }
    }).catch(err => {
      console.error(err);
      alert("Error de conexión.");
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
                      <span className="font-semibold text-foreground block leading-tight">{ent.razonSocial}</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">{ent.tipoEjecutor || 'Ejecutor No Def.'}</span>
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
          
          {/* Logo & Identity */}
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
              <p className="text-[10px] text-muted-foreground text-center">Carga el logo oficial de la entidad (PNG, JPG o SVG)</p>
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

          {/* Core Data */}
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

          {/* Contact & Location */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3"><MapPin className="h-4 w-4 text-primary" /> Contacto y Ubicación</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Correo *</label>
                <input type="email" value={formData.correo} onChange={e=>setFormData({...formData, correo: e.target.value})} className={cn("w-full h-9 px-3 bg-background border rounded-md text-[13px]", errors.correo ? "border-destructive/50" : "border-input")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Celular</label>
                <input value={formData.celular} onChange={e=>setFormData({...formData, celular: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Dirección</label>
              <input value={formData.direccion} onChange={e=>setFormData({...formData, direccion: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Ciudad</label>
                <input value={formData.ciudad} onChange={e=>setFormData({...formData, ciudad: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Sitio Web</label>
                <input value={formData.paginaWeb} onChange={e=>setFormData({...formData, paginaWeb: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
            </div>
          </div>

          {/* Operational Scope */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 lg:col-span-2">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3">
              <ListFilter className="h-4 w-4 text-primary" /> Alcance Operativo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
    </div>
  );
}
