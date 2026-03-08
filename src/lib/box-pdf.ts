import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Amiri font for Arabic support - loaded from CDN
let amiriFontLoaded = false;
let amiriFontBase64 = '';

const loadAmiriFont = async () => {
  if (amiriFontLoaded) return;
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.18/files/amiri-arabic-400-normal.woff');
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    amiriFontBase64 = btoa(binary);
    amiriFontLoaded = true;
  } catch {
    console.warn('Could not load Amiri font, Arabic text may not render correctly');
  }
};

const hasArabic = (text: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

interface PrintBoxOptions {
  boxId: string;
  boxName: string;
  warehouseName: string;
}

export const printBoxPDF = async ({ boxId, boxName, warehouseName }: PrintBoxOptions) => {
  try {
    // Load Arabic font in parallel with data fetch
    const [fontResult, parcelsResult] = await Promise.all([
      loadAmiriFont(),
      supabase
        .from('parcels')
        .select('tracking, boutique, created_at, added_by, profiles:added_by(full_name)')
        .eq('box_id', boxId)
        .order('boutique', { ascending: true, nullsFirst: false }),
    ]);

    const { data: parcels, error } = parcelsResult;
    if (error) throw error;

    const doc = new jsPDF();

    // Register Amiri font if loaded
    if (amiriFontLoaded && amiriFontBase64) {
      doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    }

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

    const useArabicFont = amiriFontLoaded && (parcels || []).some((p: any) => hasArabic(p.boutique || ''));

    autoTable(doc, {
      startY: 72,
      head: [['#', 'Tracking', 'Boutique', 'Ajouté par', "Date d'ajout"]],
      body: tableData,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        ...(useArabicFont ? { font: 'Amiri' } : {}),
      },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        2: { halign: useArabicFont ? 'right' : 'left' }, // Boutique column RTL if Arabic
      },
    });

    doc.save(`${boxName}_${today.replace(/ /g, '_')}.pdf`);
    toast.success('PDF téléchargé');
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors de la génération du PDF');
  }
};
