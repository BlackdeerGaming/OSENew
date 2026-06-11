import React, { useEffect, useState, useCallback } from 'react';
import { HardDrive, Network, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

const fmtBytes = (b) => {
  if (!b && b !== 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Number(b);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
};

const colorFor = (pct) => {
  if (pct >= 100) return { bar: 'bg-rose-500', text: 'text-rose-600', track: 'bg-rose-100' };
  if (pct >= 80)  return { bar: 'bg-amber-500', text: 'text-amber-600', track: 'bg-amber-100' };
  return               { bar: 'bg-primary',    text: 'text-primary',   track: 'bg-border/50' };
};

function MiniBar({ icon: Icon, label, pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const { bar, text, track } = colorFor(pct);
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('w-2.5 h-2.5 shrink-0', text)} />
      <span className="text-[9px] text-muted-foreground shrink-0">{label}</span>
      <div className={cn('flex-1 h-1 rounded-full overflow-hidden', track)}>
        <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={cn('text-[9px] font-black tabular-nums w-7 text-right shrink-0', text)}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function QuotaWidget({ currentUser, currentEntity }) {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchQuota = useCallback(async () => {
    if (!currentEntity?.id || !currentUser?.token) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE_URL}/entities/${currentEntity.id}/quota`, {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
          'x-entity-context': currentEntity.id,
        },
      });
      if (!res.ok) throw new Error();
      setQuota(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentEntity?.id, currentUser?.token]);

  useEffect(() => { fetchQuota(); }, [fetchQuota]);

  if (loading && !quota) return null;
  if (error || !quota || !quota.quota_enabled) return null;

  const hasWarning = quota.dependency_pct >= 80 || quota.storage_pct >= 80;
  const hasBlock   = quota.dependency_pct >= 100 || quota.storage_pct >= 100;
  const showDeps    = quota.dependency_limit > 0;
  const showStorage = quota.storage_limit_bytes > 0;
  if (!showDeps && !showStorage) return null;

  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group',
      hasBlock   && 'border-l-4 border-l-rose-500',
      hasWarning && !hasBlock && 'border-l-4 border-l-amber-400',
    )}>
      {/* Background icon */}
      <div className="absolute -bottom-2 -right-2 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
        <Zap className="w-16 h-16" />
      </div>

      <div className="flex flex-col gap-3 relative z-10">
        {/* Header — same pattern as StatsCard */}
        <div className="flex items-center justify-between">
          <div className={cn('p-2 rounded-lg border',
            hasBlock   ? 'bg-rose-50  border-rose-100  text-rose-500'  :
            hasWarning ? 'bg-amber-50 border-amber-100 text-amber-500' :
                         'bg-primary/10 border-primary/10 text-primary'
          )}>
            <Zap className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-1.5">
            {(hasWarning || hasBlock) && (
              <div className={cn(
                'px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5',
                hasBlock ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
              )}>
                <div className={cn('h-1.5 w-1.5 rounded-full', hasBlock ? 'bg-rose-500' : 'bg-amber-500')} />
                {hasBlock ? 'Límite' : 'Alerta'}
              </div>
            )}
            <button
              onClick={fetchQuota}
              disabled={loading}
              className="p-1 rounded text-muted-foreground hover:bg-secondary transition-colors"
              title="Actualizar cuota"
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Plan name — same as the big stat number */}
        <div className="space-y-0.5">
          <h4 className="text-2xl font-bold text-foreground tracking-tight leading-none">
            {quota.plan_name || 'Free'}
          </h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Plan activo</p>
        </div>

        {/* Compact bars — same chip style as StatsCard footer */}
        <div className="flex flex-col gap-1.5 bg-secondary/50 p-2 rounded-md border border-border">
          {showDeps && (
            <MiniBar icon={Network} label="Depend." pct={quota.dependency_pct} />
          )}
          {showStorage && (
            <MiniBar icon={HardDrive} label="Almac." pct={quota.storage_pct} />
          )}
        </div>
      </div>
    </div>
  );
}
