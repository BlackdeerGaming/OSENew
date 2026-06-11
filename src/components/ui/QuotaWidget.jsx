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
  if (pct >= 100) return { bar: 'bg-rose-500', text: 'text-rose-600', trackBg: 'bg-rose-100' };
  if (pct >= 80)  return { bar: 'bg-amber-500', text: 'text-amber-600', trackBg: 'bg-amber-100' };
  return               { bar: 'bg-primary',    text: 'text-primary',   trackBg: 'bg-secondary' };
};

function QuotaBar({ icon: Icon, label, usedLabel, limitLabel, remainLabel, pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const { bar, text, trackBg } = colorFor(pct);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('w-3 h-3 shrink-0', text)} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </span>
        </div>
        <span className={cn('text-[10px] font-black tabular-nums shrink-0', text)}>
          {usedLabel} / {limitLabel}
        </span>
      </div>

      <div className={cn('h-1.5 w-full rounded-full overflow-hidden', trackBg)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">
          {pct >= 100
            ? 'Sin espacio disponible'
            : `Disponible: ${remainLabel}`}
        </span>
        <span className={cn('text-[9px] font-black', text)}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function QuotaWidget({ currentUser, currentEntity }) {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

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

  // Don't render anything if quota is disabled or we're still loading without data
  if (loading && !quota) return null;
  if (error || !quota || !quota.quota_enabled) return null;

  const hasWarning = quota.dependency_pct >= 80 || quota.storage_pct >= 80;
  const hasBlock   = quota.dependency_pct >= 100 || quota.storage_pct >= 100;

  const showDeps    = quota.dependency_limit > 0;
  const showStorage = quota.storage_limit_bytes > 0;
  if (!showDeps && !showStorage) return null;

  return (
    <div className={cn(
      'rounded-xl border bg-card shadow-sm p-4 flex flex-col gap-3 transition-colors',
      hasBlock   ? 'border-rose-200  bg-rose-50/30'  :
      hasWarning ? 'border-amber-200 bg-amber-50/20' :
                   'border-border'
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'p-1.5 rounded-lg',
            hasBlock   ? 'bg-rose-100   text-rose-500'   :
            hasWarning ? 'bg-amber-100  text-amber-500'  :
                         'bg-primary/10 text-primary'
          )}>
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div className="leading-none">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
              Plan activo
            </p>
            <p className="text-[13px] font-black text-foreground">
              {quota.plan_name || 'Free'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(hasWarning || hasBlock) && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider',
              hasBlock ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            )}>
              <AlertTriangle className="w-3 h-3" />
              {hasBlock ? 'Límite alcanzado' : 'Cerca del límite'}
            </div>
          )}

          <button
            onClick={fetchQuota}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
            title="Actualizar cuota"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Bars */}
      <div className="flex flex-col gap-3">
        {showDeps && (
          <QuotaBar
            icon={Network}
            label="Dependencias"
            usedLabel={`${quota.dependency_count} dep.`}
            limitLabel={`${quota.dependency_limit} dep.`}
            remainLabel={`${quota.dependency_remaining ?? 0} dep.`}
            pct={quota.dependency_pct}
          />
        )}
        {showStorage && (
          <QuotaBar
            icon={HardDrive}
            label="Almacenamiento"
            usedLabel={fmtBytes(quota.storage_used_bytes)}
            limitLabel={quota.storage_limit_fmt}
            remainLabel={fmtBytes(quota.storage_remaining_bytes)}
            pct={quota.storage_pct}
          />
        )}
      </div>
    </div>
  );
}
