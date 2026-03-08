import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, ArrowRightLeft, AlertTriangle, CheckCircle, Clock, Plus } from 'lucide-react';

interface HistoryEvent {
  id: string;
  type: 'status' | 'transfer_initiated' | 'transfer_completed' | 'transfer_misrouted';
  label: string;
  timestamp: string;
  actor: string | null;
  location: string | null;
}

interface ParcelHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcel: {
    id: string;
    tracking: string;
    boutique?: string | null;
    box_name?: string | null;
    is_multi_part?: boolean;
    part_number?: number;
    total_parts?: number;
  } | null;
}

const statusLabel = (s: string) => {
  if (s === 'in_stock') return 'En stock';
  if (s === 'given') return 'Donné';
  if (s === 'missing') return 'Manquant';
  if (s === 'found') return 'Trouvé';
  if (s.startsWith('Transfert vers')) return s;
  return s;
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const eventIcon = (type: HistoryEvent['type']) => {
  switch (type) {
    case 'transfer_initiated': return <ArrowRightLeft className="w-3.5 h-3.5" />;
    case 'transfer_completed': return <CheckCircle className="w-3.5 h-3.5" />;
    case 'transfer_misrouted': return <AlertTriangle className="w-3.5 h-3.5" />;
    default: return <Package className="w-3.5 h-3.5" />;
  }
};

const eventColor = (type: HistoryEvent['type']) => {
  switch (type) {
    case 'transfer_initiated': return 'bg-amber-500/20 text-amber-700 border-amber-300';
    case 'transfer_completed': return 'bg-emerald-500/20 text-emerald-700 border-emerald-300';
    case 'transfer_misrouted': return 'bg-destructive/20 text-destructive border-destructive/30';
    default: return '';
  }
};

const ParcelHistoryDialog: React.FC<ParcelHistoryDialogProps> = ({ open, onOpenChange, parcel }) => {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && parcel) loadHistory(parcel.id);
  }, [open, parcel?.id]);

  const loadHistory = async (parcelId: string) => {
    setLoading(true);
    const allEvents: HistoryEvent[] = [];

    // 1. Status log
    const { data: statusLogs } = await supabase
      .from('parcel_status_log')
      .select('id, status, created_at, profiles:changed_by(full_name), warehouses:warehouse_id(name)')
      .eq('parcel_id', parcelId)
      .order('created_at', { ascending: false });

    if (statusLogs) {
      statusLogs.forEach((l: any) => {
        allEvents.push({
          id: `sl-${l.id}`,
          type: 'status',
          label: statusLabel(l.status),
          timestamp: l.created_at,
          actor: l.profiles?.full_name || null,
          location: l.warehouses?.name || null,
        });
      });
    }

    // 2. Transfer history
    const { data: transfers } = await supabase
      .from('transfer_history')
      .select('id, status, initiated_at, completed_at, from_warehouse:from_warehouse_id(name), to_warehouse:to_warehouse_id(name), initiator:initiated_by(full_name)')
      .eq('parcel_id', parcelId)
      .order('initiated_at', { ascending: false });

    if (transfers) {
      transfers.forEach((t: any) => {
        // Initiation event
        allEvents.push({
          id: `ti-${t.id}`,
          type: 'transfer_initiated',
          label: `Transfert initié → ${t.to_warehouse?.name || '?'}`,
          timestamp: t.initiated_at,
          actor: t.initiator?.full_name || null,
          location: t.from_warehouse?.name || null,
        });

        // Completion/misroute event
        if (t.status === 'completed' && t.completed_at) {
          allEvents.push({
            id: `tc-${t.id}`,
            type: 'transfer_completed',
            label: `Transfert reçu à ${t.to_warehouse?.name || '?'}`,
            timestamp: t.completed_at,
            actor: null,
            location: t.to_warehouse?.name || null,
          });
        } else if (t.status === 'misrouted') {
          allEvents.push({
            id: `tm-${t.id}`,
            type: 'transfer_misrouted',
            label: `Transfert mal dirigé (destination: ${t.to_warehouse?.name || '?'})`,
            timestamp: t.completed_at || t.initiated_at,
            actor: null,
            location: null,
          });
        }
      });
    }

    // Sort newest first
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(allEvents);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">{parcel?.tracking}</span>
            {parcel?.is_multi_part && (
              <Badge variant="outline" className="text-xs font-mono">
                {parcel.part_number}/{parcel.total_parts}
              </Badge>
            )}
          </DialogTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            {parcel?.boutique && <span>{parcel.boutique}</span>}
            {parcel?.box_name && <span>📦 {parcel.box_name}</span>}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="mt-2">
            <h4 className="text-sm font-semibold mb-3">Historique complet</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun historique</p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {events.map((ev, i) => (
                  <div key={ev.id} className="relative flex items-start gap-3 pb-4">
                    <div className={`relative z-10 w-[15px] h-[15px] rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      i === 0
                        ? 'bg-primary border-primary'
                        : 'bg-background border-muted-foreground/40'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.type !== 'status' && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${eventColor(ev.type)}`}>
                            {eventIcon(ev.type)}
                          </span>
                        )}
                        <Badge
                          variant={ev.type === 'transfer_misrouted' ? 'destructive' : ev.type === 'transfer_completed' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {ev.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>🕐 {formatDate(ev.timestamp)}</span>
                        {ev.location && <span>📍 {ev.location}</span>}
                        {ev.actor && <span>👤 {ev.actor}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ParcelHistoryDialog;
