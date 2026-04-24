import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search, Briefcase, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FuncionesMultiSelect
 * Dropdown con checkboxes para selección múltiple de funciones.
 *
 * Props:
 *  - funciones: [{ id, titulo, codigo_funcion, dependencia_id }]
 *  - selectedIds: string[]  — array de IDs seleccionados
 *  - onChange: (ids: string[]) => void
 *  - filteredDependenciaId: string | null — si está presente, filtra funciones por dependencia
 *  - disabled: boolean
 */
export default function FuncionesMultiSelect({
  funciones = [],
  selectedIds = [],
  onChange,
  filteredDependenciaId = null,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Cierra dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus en el buscador al abrir
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Filtrar funciones por dependencia (si aplica) y por búsqueda
  const availableFunciones = funciones.filter((f) => {
    const matchesDep =
      !filteredDependenciaId || f.dependencia_id === filteredDependenciaId;
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      (f.titulo?.toLowerCase() || "").includes(term) ||
      (f.codigo_funcion?.toLowerCase() || "").includes(term);
    return matchesDep && matchesSearch;
  });

  const selectedFunciones = funciones.filter((f) =>
    selectedIds.includes(f.id)
  );

  const toggleId = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeId = (id, e) => {
    e.stopPropagation();
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      if (prev) setSearch("");
      return !prev;
    });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger / display area */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
          if (e.key === "Escape") {
            setIsOpen(false);
            setSearch("");
          }
        }}
        className={cn(
          "min-h-[38px] w-full border rounded-md px-3 py-2 bg-background text-sm",
          "flex items-start gap-2 flex-wrap cursor-pointer transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          isOpen
            ? "border-primary ring-2 ring-primary/20"
            : "border-border hover:border-primary/50",
          disabled && "opacity-60 cursor-not-allowed bg-secondary/30"
        )}
      >
        {/* Chips de funciones seleccionadas */}
        {selectedFunciones.length === 0 ? (
          <span className="text-muted-foreground select-none self-center">
            Seleccionar funciones...
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5 flex-1">
            {selectedFunciones.map((f) => (
              <span
                key={f.id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                  "bg-primary/10 text-primary border border-primary/20",
                  "transition-all duration-150"
                )}
              >
                {f.codigo_funcion && (
                  <span className="font-mono opacity-70">{f.codigo_funcion}</span>
                )}
                <span className="max-w-[160px] truncate">{f.titulo}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeId(f.id, e)}
                    className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                    aria-label={`Quitar ${f.titulo}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 self-center ml-auto transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className={cn(
            "absolute z-50 mt-1.5 w-full bg-card border border-border rounded-lg shadow-xl",
            "flex flex-col overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          style={{ maxHeight: "280px" }}
        >
          {/* Búsqueda interna */}
          <div className="p-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar función..."
                className={cn(
                  "w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-input rounded-md",
                  "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary",
                  "transition-all"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Lista de opciones */}
          <div className="overflow-y-auto flex-1">
            {availableFunciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <Briefcase className="h-6 w-6 opacity-30" />
                <span>
                  {search
                    ? "Sin coincidencias"
                    : filteredDependenciaId
                    ? "Sin funciones para esta dependencia"
                    : "No hay funciones registradas"}
                </span>
              </div>
            ) : (
              availableFunciones.map((f) => {
                const isSelected = selectedIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-100",
                      "hover:bg-secondary/60",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleId(f.id);
                    }}
                  >
                    {/* Checkbox custom */}
                    <div
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-all duration-150",
                        isSelected
                          ? "bg-primary border-primary"
                          : "bg-background border-border"
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="h-2.5 w-2.5 text-primary-foreground"
                          fill="none"
                          viewBox="0 0 12 12"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2 6l3 3 5-5"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Info función */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {f.codigo_funcion && (
                          <span className="text-[10px] font-mono bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                            {f.codigo_funcion}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            isSelected ? "text-primary" : "text-foreground"
                          )}
                        >
                          {f.titulo}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer con contador */}
          {selectedIds.length > 0 && (
            <div className="border-t border-border px-3 py-2 shrink-0 flex items-center justify-between text-xs text-muted-foreground bg-secondary/30">
              <span className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                <strong className="text-primary">{selectedIds.length}</strong> función
                {selectedIds.length !== 1 ? "es" : ""} seleccionada
                {selectedIds.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-destructive hover:underline font-medium transition-colors"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
