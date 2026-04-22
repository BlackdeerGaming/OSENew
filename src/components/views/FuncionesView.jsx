import React, { useState, useEffect } from "react";
import { Search, Plus, Trash2, Edit2, AlertCircle, Loader2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";
import FuncionModal from "../forms/FuncionModal";
import ViewHeader from "../ui/ViewHeader";


export default function FuncionesView({ dependencias, entities, currentUser }) {
  const [funciones, setFunciones] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editFuncion, setEditFuncion] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const activeEntityId = entities?.[0]?.id || currentUser?.entity_id;

  // Load functions
  const loadFunciones = async () => {
    setLoading(true);
    setError(null);
    if (!activeEntityId) {
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/funciones`, {
        headers: {
          "Authorization": `Bearer ${currentUser.token || ''}`
        }
      });
      if (!resp.ok) throw new Error("Error al cargar funciones");
      const data = await resp.json();
      setFunciones(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeEntityId) {
      loadFunciones();
    } else {
      setLoading(false);
    }
  }, [activeEntityId]);

  const handleDelete = async (id) => {
    if (!confirm("¿Está seguro de eliminar esta función?")) return;
    setDeletingId(id);
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/funciones/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${currentUser.token || ''}`
        }
      });
      if (!resp.ok) throw new Error("Error al eliminar función");
      setFunciones(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = () => {
    setEditFuncion(null);
    setIsModalOpen(true);
  };

  const handleEdit = (funcion) => {
    setEditFuncion(funcion);
    setIsModalOpen(true);
  };

  const filteredFunciones = funciones.filter(f => {
    const term = searchQuery.toLowerCase();
    const titulo = f.titulo?.toLowerCase() || "";
    const codigo = f.codigo_funcion?.toLowerCase() || "";
    const dep = dependencias.find(d => d.id === f.dependencia_id);
    const depName = dep?.nombre?.toLowerCase() || "";
    
    return titulo.includes(term) || codigo.includes(term) || depName.includes(term);
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <ViewHeader
        icon={Briefcase}
        title="Funciones"
        subtitle="Gestión de funciones administrativas por dependencia"
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar función o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 bg-background border border-input rounded-md py-1.5 pl-9 pr-3 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-1.5 rounded-md font-semibold text-[12.5px] transition-all active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Nueva Función
            </button>
          </>
        }
      />

      {/* Main Content List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
             <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
               <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
               <p>Cargando funciones...</p>
             </div>
          ) : error ? (
            <div className="p-6 bg-destructive/10 text-destructive rounded-xl flex items-center gap-4">
              <AlertCircle className="h-6 w-6" />
              <div>
                 <h3 className="font-bold">Error de Carga</h3>
                 <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : filteredFunciones.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card flex flex-col items-center justify-center min-h-[300px]">
              <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                <Briefcase className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No hay funciones creadas</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mb-6">
                No se encontraron funciones {searchQuery ? "que coincidan con tu búsqueda." : "registradas para esta entidad."}
              </p>
              {!searchQuery && (
                <button 
                  onClick={handleCreate}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-semibold text-sm shadow transition-all active:scale-95 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Registrar mi primera función
                </button>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
               <div className="overflow-x-auto min-h-[400px]">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border font-semibold">
                      <tr>
                        <th className="px-6 py-4 w-[15%]">Código</th>
                        <th className="px-6 py-4 w-[35%]">Título de Función</th>
                        <th className="px-6 py-4 w-[30%]">Dependencia / Proyecto</th>
                        <th className="px-6 py-4 w-[20%] text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredFunciones.map((f) => {
                        const dep = dependencias.find(d => d.id === f.dependencia_id);
                        return (
                          <tr key={f.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono bg-secondary px-2 py-1 rounded text-xs font-medium border border-border">
                                {f.codigo_funcion || "S/C"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-foreground line-clamp-2" title={f.titulo}>
                                {f.titulo}
                              </div>
                              {f.descripcion && (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1" title={f.descripcion}>
                                  {f.descripcion}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-foreground">
                                {dep ? dep.nombre : "Desconocida"}
                                {dep?.codigo && <span className="text-muted-foreground ml-1 font-mono text-xs">({dep.codigo})</span>}
                              </div>
                              {f.proyecto_nombre && (
                                <div className="text-xs text-muted-foreground mt-1 bg-secondary/50 inline-block px-1.5 py-0.5 rounded">
                                  {f.proyecto_sigla && <span className="font-bold mr-1">{f.proyecto_sigla}</span>}
                                  {f.proyecto_nombre}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEdit(f)}
                                  className="p-2 text-muted-foreground hover:bg-secondary hover:text-foreground rounded-md transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(f.id)}
                                  disabled={deletingId === f.id}
                                  className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors disabled:opacity-50"
                                  title="Eliminar"
                                >
                                  {deletingId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
          )}
        </div>
      </div>

      <FuncionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(updated) => {
           loadFunciones(); // recargar para consistencia
        }}
        dependencias={dependencias}
        entities={entities}
        currentUser={currentUser}
        editData={editFuncion}
      />
    </div>
  );
}
