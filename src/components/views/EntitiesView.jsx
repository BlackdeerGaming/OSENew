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
    sector: "",
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
    paginaWeb: "",
    logoUrl: "",
    tamanoEmpresa: "Pequeña",
    estado: "Activo",
    fechaInicio: "",
    fechaFin: "",
    entidadOrganizacional: true,
    proyectos: false,
    maxUsuarios: 10,
    maxDependencias: 20,
    maxProyectos: 5,
  });

  const [errors, setErrors] = useState({});

  const filteredEntities = entities.filter(ent =>
    ent.razonSocial.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ent.numeroDocumento.includes(searchQuery)
  );

  const handleEdit = (ent) => {
    setSelectedEntity(ent);
    setFormData({ ...ent });
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
    if (!formData.correo.trim()) {
      newErrors.correo = "Obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) {
      newErrors.correo = "Formato inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
                  tipoEntidad: "Persona Jurídica", clasificacion: "Privada", razonSocial: "", sector: "",
                  tipoDocumento: "NIT", numeroDocumento: "", dv: "", ciiu: "",
                  pais: "Colombia", departamento: "", ciudad: "", direccion: "",
                  telefono: "", celular: "", correo: "", nombreContacto: "", paginaWeb: "",
                  logoUrl: "", tamanoEmpresa: "Pequeña", estado: "Activo",
                  fechaInicio: "", fechaFin: "", entidadOrganizacional: true, proyectos: false,
                  maxUsuarios: 10, maxDependencias: 20, maxProyectos: 5,
                });
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
                  <th className="px-6 py-3">Licencia</th>
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
                          {ent.razonSocial.slice(0, 2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-foreground block leading-tight">{ent.razonSocial}</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">{ent.sector || 'Sin sector'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[11px] bg-secondary/80 px-1.5 py-0.5 rounded border border-border">
                        {ent.numeroDocumento} {ent.dv && `-${ent.dv}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /> {ent.correo}</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" /> {ent.telefono || ent.celular || '--'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-medium text-muted-foreground uppercase">{ent.maxUsuarios} Usuarios</div>
                      <div className="text-[10px] text-muted-foreground/60">{ent.fechaFin ? `Vence: ${ent.fechaFin}` : 'Licencia Vitalicia'}</div>
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
          {/* General */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3"><Building2 className="h-4 w-4 text-primary" /> Datos Corporativos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Tipo</label>
                <select value={formData.tipoEntidad} onChange={e=>setFormData({...formData, tipoEntidad: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] outline-none">
                  <option>Persona Jurídica</option>
                  <option>Persona Natural</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Clasificación</label>
                <select value={formData.clasificacion} onChange={e=>setFormData({...formData, clasificacion: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] outline-none">
                  <option>Privada</option>
                  <option>Pública</option>
                  <option>Mixta</option>
                </select>
              </div>
            </div>
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

          {/* SaaS Config */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 md:col-span-2">
            <h3 className="text-[14px] font-bold flex items-center gap-2 border-b border-border pb-3"><ShieldAlert className="h-4 w-4 text-primary" /> Parámetros SaaS y Licenciamiento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Estado</label>
                <select value={formData.estado} onChange={e=>setFormData({...formData, estado: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px] font-bold text-primary">
                  <option>Activo</option>
                  <option>Inactivo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Max Usuarios</label>
                <input type="number" value={formData.maxUsuarios} onChange={e=>setFormData({...formData, maxUsuarios: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Inicio</label>
                <input type="date" value={formData.fechaInicio} onChange={e=>setFormData({...formData, fechaInicio: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Vencimiento</label>
                <input type="date" value={formData.fechaFin} onChange={e=>setFormData({...formData, fechaFin: e.target.value})} className="w-full h-9 px-3 bg-background border border-input rounded-md text-[13px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-border bg-card flex justify-end gap-3 shrink-0">
        <button onClick={() => setView("list")} className="px-5 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all">Cancelar</button>
        <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Save className="h-4 w-4" /> Guardar Organización
        </button>
      </div>
    </div>
  );
}
