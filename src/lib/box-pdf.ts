import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrintBoxOptions {
  boxId: string;
  boxName: string;
  warehouseName: string;
}

export const printBoxPDF = async ({ boxId, boxName, warehouseName }: PrintBoxOptions) => {
  try {
    const { data: parcels, error } = await supabase
      .from('parcels')
      .select('tracking, boutique, created_at')
      .eq('box_id', boxId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Header
    doc.setFontSize(22);
    doc.text(boxName, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

    doc.setFontSize(14);
    doc.text(`📍 ${warehouseName}`, doc.internal.pageSize.getWidth() / 2, 42, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Date: ${today}`, doc.internal.pageSize.getWidth() / 2, 52, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`Nombre de colis: ${parcels?.length || 0}`, doc.internal.pageSize.getWidth() / 2, 62, { align: 'center' });

    // Table
    const tableData = (parcels || []).map((p, i) => [
      String(i + 1),
      p.tracking,
      p.boutique || '-',
      new Date(p.created_at).toLocaleDateString('fr-FR'),
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['#', 'Tracking', 'Boutique', 'Date d\'ajout']],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`${boxName}_${today.replace(/ /g, '_')}.pdf`);
    toast.success('PDF téléchargé');
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors de la génération du PDF');
  }
};
