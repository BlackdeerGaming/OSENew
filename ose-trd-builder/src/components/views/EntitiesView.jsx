import React, { useState } from "react";
import { Building2, Search, Plus, ListFilter, Play, FileEdit, Trash2, ShieldAlert, ArrowLeft, Image as ImageIcon, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";

export default function EntitiesView({ entities, setEntities }) {
  const [view, setView] = useState("list"); // 'list', 'create', 'edit'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    // General
    tipoEntidad: "Persona Jurídica",
    clasificacion: "Privada",
    razonSocial: "",
    sector: "",
    // ID
    tipoDocumento: "NIT",
    numeroDocumento: "",
    dv: "",
    ciiu: "",
    // Location
    pais: "Colombia",
    departamento: "",
    ciudad: "",
    direccion: "",
    // Contact
    telefono: "",
    celular: "",
    correo: "",
    nombreContacto: "",
    paginaWeb: "",
    // Otros
    logoUrl: "",
    tipoEjecutor: "",
    tamanoEmpresa: "Pequeña",
    estado: "Activo",
    // Licenciamiento
    fechaInicio: "",
    fechaFin: "",
    // Estructura
    entidadOrganizacional: true,
    proyectos: false,
    // Config
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

  const handleSave = async () => {
    if (!validate()) return;
    
    try {
      const url = view === "create" ? `${API_BASE_URL}/entities` : `${API_BASE_URL}/entities/${selectedEntity.id}`;
      const method = view === "create" ? "POST" : "PUT";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error("Error saving entity");
      
      // Actualizar estado global refrescando desde API o optimísticamente
      const entRes = await fetch(`${API_BASE_URL}/entities`);
      if (entRes.ok) setEntities(await entRes.json());
      
      setView("list");
    } catch (err) {
      console.error("Error saving entity:", err);
      alert("Hubo un error al guardar la entidad.");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("¿Estás seguro de eliminar esta entidad cliente?")) {
      try {
        const response = await fetch(`${API_BASE_URL}/entities/${id}`, { method: "DELETE" });
        if (response.ok) {
          setEntities(entities.filter(a => a.id !== id));
        }
      } catch (err) {
        console.error("Error deleting entity:", err);
      }
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
       const url = URL.createObjectURL(file);
       setFormData({ ...formData, logoUrl: url });
    }
  };

  // ──── Vista Listado ────
  if (view === "list") {
    return (
      <div className="flex h-full flex-col p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Directorio de Entidades
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gestión SaaS de empresas e instituciones cliente.
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                tipoEntidad: "Persona Jurídica", clasificacion: "Privada", razonSocial: "", sector: "",
                tipoDocumento: "NIT", numeroDocumento: "", dv: "", ciiu: "",
                pais: "Colombia", departamento: "", ciudad: "", direccion: "",
                telefono: "", celular: "", correo: "", nombreContacto: "", paginaWeb: "",
                logoUrl: "", tipoEjecutor: "", tamanoEmpresa: "Pequeña", estado: "Activo",
                fechaInicio: "", fechaFin: "", entidadOrganizacional: true, proyectos: false,
                maxUsuarios: 10, maxDependencias: 20, maxProyectos: 5,
              });
              setErrors({});
              setView("create");
            }}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Crear Empresa
          </button>
        </div>

        <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por razón social o NIT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors">
            <ListFilter className="h-4 w-4" />
            Vistas
          </button>
        </div>

        <div className="grid gap-4 mt-6">
          {filteredEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card">
              <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-foreground">No hay entidades registradas</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Crea la primera entidad cliente para empezar a comercializar y asignarles administradores.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center">Logo</th>
                    <th className="px-4 py-3">Razón Social</th>
                    <th className="px-4 py-3">NIT / Doc</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Planes (Usuarios)</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEntities.map(ent => (
                    <tr key={ent.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-center">
                        {ent.logoUrl ? (
                          <img src={ent.logoUrl} alt="Logo" className="w-8 h-8 object-cover rounded-md mx-auto" />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center mx-auto text-muted-foreground text-xs font-bold uppercase">
                            {ent.razonSocial.slice(0, 2)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{ent.razonSocial}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{ent.numeroDocumento} {ent.dv && `-${ent.dv}`}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs">{ent.correo}</span>
                          <span className="text-xs text-muted-foreground">{ent.telefono || ent.celular}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">Max. {ent.maxUsuarios} Usr</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium border",
                          ent.estado === "Activo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"
                        )}>
                          {ent.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button onClick={() => handleEdit(ent)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
                             <FileEdit className="h-4 w-4" />
                           </button>
                           <button onClick={() => handleDelete(ent.id)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive">
                             <Trash2 className="h-4 w-4" />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──── Vista Formulario (Create / Edit) ────
  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView("list")}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {view === "create" ? "Nueva Entidad" : "Editar Entidad"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Organización cliente del ecosistema.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setView("list")} className="px-4 py-2 text-sm rounded-md border border-input hover:bg-secondary">
             Cancelar
           </button>
           <button onClick={handleSave} className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90">
             <Save className="h-4 w-4" />
             Guardar
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
        
        {/* Información General */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 font-medium">Información General</div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Tipo Entidad</label>
               <input value={formData.tipoEntidad} onChange={e=>setFormData({...formData, tipoEntidad: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Clasificación</label>
               <select value={formData.clasificacion} onChange={e=>setFormData({...formData, clasificacion: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                 <option>Pública</option>
                 <option>Privada</option>
                 <option>Mixta</option>
               </select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
               <label className="text-xs font-semibold text-muted-foreground">Razón Social *</label>
               <input value={formData.razonSocial} onChange={e=>setFormData({...formData, razonSocial: e.target.value})} className={cn("h-9 rounded-md border bg-background px-3 text-sm", errors.razonSocial ? "border-destructive" : "border-input")} />
               {errors.razonSocial && <span className="text-[10px] text-destructive">{errors.razonSocial}</span>}
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
               <label className="text-xs font-semibold text-muted-foreground">Sector Comercial</label>
               <input value={formData.sector} onChange={e=>setFormData({...formData, sector: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
        </div>

        {/* Identificación */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 font-medium">Identificación</div>
          <div className="p-5 grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Tipo Doc.</label>
               <select value={formData.tipoDocumento} onChange={e=>setFormData({...formData, tipoDocumento: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                 <option>NIT</option>
                 <option>RUT</option>
                 <option>CC</option>
               </select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
               <label className="text-xs font-semibold text-muted-foreground">Número *</label>
               <div className="flex gap-2">
                 <input value={formData.numeroDocumento} onChange={e=>setFormData({...formData, numeroDocumento: e.target.value})} className={cn("h-9 flex-1 rounded-md border bg-background px-3 text-sm", errors.numeroDocumento ? "border-destructive" : "border-input")} />
                 <input placeholder="DV" value={formData.dv} onChange={e=>setFormData({...formData, dv: e.target.value})} className="h-9 w-12 rounded-md border border-input bg-background px-2 text-sm text-center" />
               </div>
            </div>
            <div className="flex flex-col gap-1.5 col-span-3">
               <label className="text-xs font-semibold text-muted-foreground">CIIU (Actividad Económica)</label>
               <input value={formData.ciiu} onChange={e=>setFormData({...formData, ciiu: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50" placeholder="Ej: 6201, 8411..." />
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 font-medium">Ubicación</div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">País</label>
               <input value={formData.pais} onChange={e=>setFormData({...formData, pais: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Departamento</label>
               <input value={formData.departamento} onChange={e=>setFormData({...formData, departamento: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 relative">
               <label className="text-xs font-semibold text-muted-foreground">Ciudad & Dirección Físca</label>
               <div className="flex gap-2">
                 <input placeholder="Ciudad" value={formData.ciudad} onChange={e=>setFormData({...formData, ciudad: e.target.value})} className="h-9 w-1/3 rounded-md border border-input bg-background px-3 text-sm" />
                 <input placeholder="Av Calle Principal #1-23" value={formData.direccion} onChange={e=>setFormData({...formData, direccion: e.target.value})} className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
               </div>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 font-medium">Contacto</div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Nombre / Encargado</label>
               <input value={formData.nombreContacto} onChange={e=>setFormData({...formData, nombreContacto: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Correo Electrónico *</label>
               <input type="email" value={formData.correo} onChange={e=>setFormData({...formData, correo: e.target.value})} className={cn("h-9 rounded-md border bg-background px-3 text-sm", errors.correo ? "border-destructive" : "border-input")} />
            </div>
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Teléfonos (Fijo & Cel)</label>
               <div className="flex gap-2">
                 <input placeholder="Fijo" value={formData.telefono} onChange={e=>setFormData({...formData, telefono: e.target.value})} className="h-9 w-1/2 rounded-md border border-input bg-background px-3 text-sm" />
                 <input placeholder="Celular" value={formData.celular} onChange={e=>setFormData({...formData, celular: e.target.value})} className="h-9 w-1/2 rounded-md border border-input bg-background px-3 text-sm" />
               </div>
            </div>
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-semibold text-muted-foreground">Página Web</label>
               <input value={formData.paginaWeb} onChange={e=>setFormData({...formData, paginaWeb: e.target.value})} placeholder="https://" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
        </div>

        {/* Otros y Licenciamiento */}
        <div className="col-span-1 xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex flex-col">
            <div className="px-5 py-3 border-b border-border bg-secondary/30 font-medium">Identidad & Licencia</div>
            <div className="p-5 grid grid-cols-2 gap-4 flex-1">
              <div className="col-span-2 flex items-center gap-4">
                 <div className="h-16 w-16 rounded-md border border-dashed border-muted-foreground/50 bg-secondary flex items-center justify-center overflow-hidden">
                   {formData.logoUrl ? <img src={formData.logoUrl} className="w-full h-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground/50" />}
                 </div>
                 <div className="flex flex-col">
                   <label className="text-xs font-semibold text-muted-foreground mb-1">Logo Institucional</label>
                   <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20" />
                 </div>
              </div>
              <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-semibold text-muted-foreground">Estado Plataforma *</label>
                 <select value={formData.estado} onChange={e=>setFormData({...formData, estado: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium">
                   <option>Activo</option>
                   <option>Inactivo</option>
                   <option>Bloqueado</option>
                 </select>
              </div>
              <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-semibold text-muted-foreground">Tamaño Empresa</label>
                 <select value={formData.tamanoEmpresa} onChange={e=>setFormData({...formData, tamanoEmpresa: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                   <option>Micro</option>
                   <option>Pequeña</option>
                   <option>Mediana</option>
                   <option>Gran Empresa</option>
                 </select>
              </div>
              <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-semibold text-muted-foreground">Inicio Licencia</label>
                 <input type="date" value={formData.fechaInicio} onChange={e=>setFormData({...formData, fechaInicio: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-semibold text-muted-foreground">Fin Licencia</label>
                 <input type="date" value={formData.fechaFin} onChange={e=>setFormData({...formData, fechaFin: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex flex-col">
            <div className="px-5 py-3 border-b border-border bg-secondary/30 font-medium">Límites & Estructura (SaaS)</div>
            <div className="p-5 flex flex-col gap-5 flex-1">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Topes Permisibles</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] text-muted-foreground">Máx Usuarios</label>
                     <input type="number" min="1" value={formData.maxUsuarios} onChange={e=>setFormData({...formData, maxUsuarios: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-center font-mono" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] text-muted-foreground">Máx Dependen.</label>
                     <input type="number" min="1" value={formData.maxDependencias} onChange={e=>setFormData({...formData, maxDependencias: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-center font-mono" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] text-muted-foreground">Máx Proyectos</label>
                     <input type="number" min="0" value={formData.maxProyectos} onChange={e=>setFormData({...formData, maxProyectos: e.target.value})} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-center font-mono" />
                  </div>
                </div>
              </div>
              <hr className="border-border" />
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Módulos Habilitados</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.entidadOrganizacional} onChange={e=>setFormData({...formData, entidadOrganizacional: e.target.checked})} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm font-medium">Entidad Organizacional Completa (TRD, Series)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.proyectos} onChange={e=>setFormData({...formData, proyectos: e.target.checked})} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm font-medium">Gestión de Proyectos Individuales</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
