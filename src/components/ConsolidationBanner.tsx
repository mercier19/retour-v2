import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { PackageCheck, Loader2 } from 'lucide-react';

interface Suggestion {
  boutique: string;
  count: number;
  boxCount: number;
  boxIds: string[];
  warehouseId: string;
}

interface ConsolidationBannerProps {
  warehouseIds: string[];
  threshold: number;
  enabled: boolean;
  onConsolidated: () => void;
}

const ConsolidationBanner: React.FC<ConsolidationBannerProps> = ({
  warehouseIds,
  threshold,
  enabled,
  onConsolidated,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [consolidating, setConsolidating] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || warehouseIds.length === 0) {
      setSuggestions([]);
      return;
    }
    loadSuggestions();
  }, [enabled, warehouseIds.join(','), threshold]);

  const loadSuggestions = async () => {
    setLoading(true);
    const { data: parcels } = await supabase
      .from('parcels')
      .select('boutique, box_id, warehouse_id')
      .in('warehouse_id', warehouseIds)
      .not('boutique', 'is', null)
      .not('box_id', 'is', null);

    if (!parcels) {
      setLoading(false);
      return;
    }

    // Group by warehouse_id + boutique
    const grouped = new Map<string, { boxIds: Set<string>; count: number; warehouseId: string }>();

    for (const p of parcels) {
      if (!p.boutique || !p.box_id) continue;
      const key = `${p.warehouse_id}::${p.boutique}`;
      if (!grouped.has(key)) {
        grouped.set(key, { boxIds: new Set(), count: 0, warehouseId: p.warehouse_id });
      }
      const entry = grouped.get(key)!;
      entry.boxIds.add(p.box_id);
      entry.count += 1;
    }

    const results: Suggestion[] = [];
    for (const [key, { boxIds, count, warehouseId }] of grouped) {
      const boutique = key.split('::').slice(1).join('::');
      if (count >= threshold && boxIds.size > 1) {
        results.push({ boutique, count, boxCount: boxIds.size, boxIds: Array.from(boxIds), warehouseId });
      }
    }

    results.sort((a, b) => b.count - a.count);
    setSuggestions(results);
    setLoading(false);
  };

  const handleConsolidate = async (suggestion: Suggestion) => {
    setConsolidating(`${suggestion.warehouseId}::${suggestion.boutique}`);

    const today = new Date().toISOString().slice(0, 10);
    let boxName = `Boutique ${suggestion.boutique}`;

    const { data: existing } = await supabase
      .from('boxes')
      .select('name')
      .eq('warehouse_id', suggestion.warehouseId)
      .eq('name', boxName);

    if (existing && existing.length > 0) {
      boxName = `${boxName} ${today}`;
      const { data: existing2 } = await supabase
        .from('boxes')
        .select('name')
        .eq('warehouse_id', suggestion.warehouseId)
        .eq('name', boxName);
      if (existing2 && existing2.length > 0) {
        boxName = `${boxName}-${Math.random().toString(36).slice(2, 6)}`;
      }
    }

    const { data: newBox, error: boxError } = await supabase
      .from('boxes')
      .insert({ warehouse_id: suggestion.warehouseId, name: boxName, quota: 500 })
      .select()
      .single();

    if (boxError || !newBox) {
      toast.error('Erreur lors de la création de la box: ' + (boxError?.message || ''));
      setConsolidating(null);
      return;
    }

    const { error: updateError } = await supabase
      .from('parcels')
      .update({ box_id: newBox.id })
      .eq('warehouse_id', suggestion.warehouseId)
      .eq('boutique', suggestion.boutique);

    if (updateError) {
      toast.error('Erreur lors du déplacement: ' + updateError.message);
    } else {
      toast.success(
        `${suggestion.count} colis de "${suggestion.boutique}" rassemblés dans "${boxName}"`
      );
      setSuggestions((prev) => prev.filter((s) => !(s.boutique === suggestion.boutique && s.warehouseId === suggestion.warehouseId)));
      onConsolidated();
    }
    setConsolidating(null);
  };

  if (!enabled || suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      {suggestions.slice(0, 3).map((s) => (
        <Card key={`${s.warehouseId}::${s.boutique}`} className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <PackageCheck className="w-5 h-5 text-yellow-600 shrink-0" />
              <p className="text-sm">
                <span className="font-semibold">{s.boutique}</span> : {s.count} colis répartis dans{' '}
                <span className="font-semibold">{s.boxCount} boxes</span>. Rassemblez-les ?
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-yellow-600 text-yellow-700 hover:bg-yellow-500/20"
              onClick={() => handleConsolidate(s)}
              disabled={consolidating === `${s.warehouseId}::${s.boutique}`}
            >
              {consolidating === `${s.warehouseId}::${s.boutique}` ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              Rassembler
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ConsolidationBanner;
