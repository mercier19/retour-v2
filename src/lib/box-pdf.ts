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
      .select('tracking, boutique, created_at, added_by, profiles:added_by(full_name)')
      .eq('box_id', boxId)
      .order('boutique', { ascending: true, nullsFirst: false });

    if (error) throw error;

    const doc = new jsPDF();

    const today = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.text(boxName, pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(14);
    doc.text(warehouseName, pageWidth / 2, 42, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Date: ${today}`, pageWidth / 2, 52, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`Nombre de colis: ${parcels?.length || 0}`, pageWidth / 2, 62, { align: 'center' });

    // Table data
    const tableData = (parcels || []).map((p: any, i: number) => [
      String(i + 1),
      p.tracking,
      p.boutique || '-',
      p.profiles?.full_name || '-',
      new Date(p.created_at).toLocaleDateString('fr-FR'),
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['#', 'Tracking', 'Boutique', 'Ajouté par', "Date d'ajout"]],
      body: tableData,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
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
