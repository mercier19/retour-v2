import { toast } from 'sonner';

type ParcelExportRow = {
  tracking: string;
  box_name?: string | null;
  boxes?: { name?: string | null } | null;
  boutique?: string | null;
  wilaya?: string | null;
  commune?: string | null;
  status?: string | null;
  is_missing?: boolean | null;
  is_multi_part?: boolean;
  part_number?: number;
  total_parts?: number;
  created_at: string;
};

interface ExportOptions {
  agentName?: string;
  warehouseName?: string;
}

export const exportParcelsToExcel = async (rows: ParcelExportRow[], filename: string, options?: ExportOptions) => {
  if (rows.length === 0) {
    toast.info('Aucun colis à exporter');
    return;
  }

  const XLSX = await import('xlsx');

  const agent = options?.agentName || 'Inconnu';
  const localisation = options?.warehouseName || 'Inconnu';

  const worksheetData = rows.map((p) => ({
    Agent: agent,
    Localisation: localisation,
    Tracking: p.tracking,
    Partie: p.is_multi_part ? `${p.part_number || 1}/${p.total_parts || 1}` : '1/1',
    Box: p.box_name || p.boxes?.name || '',
    Boutique: p.boutique || '',
    Wilaya: p.wilaya || '',
    Commune: p.commune || '',
    Statut: p.status || '',
    Manquant: p.is_missing ? 'Oui' : 'Non',
    Date: new Date(p.created_at).toLocaleDateString('fr-FR'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');
  XLSX.writeFile(workbook, filename);
  toast.success('Export téléchargé');
};
