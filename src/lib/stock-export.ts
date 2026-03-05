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
  created_at: string;
};

export const exportParcelsToExcel = async (rows: ParcelExportRow[], filename: string) => {
  if (rows.length === 0) {
    toast.info('Aucun colis à exporter');
    return;
  }

  const XLSX = await import('xlsx');

  const worksheetData = rows.map((p) => ({
    Tracking: p.tracking,
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
