import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SearchableSelect({ 
  name, 
  value, 
  onChange, 
  options = [], 
  placeholder = "Seleccione...", 
  disabled = false,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  // Parse current selected label
  const selectedOption = options.find(opt => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (selectedValue) => {
    onChange({ target: { name, value: selectedValue } });
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={cn("relative w-full", isOpen ? "z-50" : "z-auto")} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selectedOption && !value && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : (value || placeholder)}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute z-[999] top-[calc(100%+4px)] left-0 w-full rounded-md border border-border bg-white shadow-2xl animate-in fade-in-80 slide-in-from-top-1">
          <div className="flex items-center border-b border-border px-3 rounded-t-md">
            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
            <input
              autoFocus
              className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground text-black font-medium"
              placeholder="Escribe para buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-2 px-2 text-sm outline-none hover:bg-slate-100 text-left text-black",
                    value === opt.value ? "bg-primary/10 text-primary font-medium" : ""
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
