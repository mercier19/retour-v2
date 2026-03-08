import PptxGenJS from 'pptxgenjs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WarehouseStat {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_type: string;
  received: number;
  given: number;
  missing: number;
  in_transit: number;
  misrouted: number;
  active_in_stock: number;
}

interface UserRankingItem {
  userId: string;
  userName: string;
  total: number;
  details: Record<string, number>;
}

interface GlobalStats {
  received: number;
  given: number;
  missing: number;
  in_transit: number;
  misrouted: number;
  active_in_stock: number;
}

export const generateAdvancedReport = async (
  globalStats: GlobalStats,
  warehouseStats: WarehouseStat[],
  userRanking: UserRankingItem[],
  dateLabel: string,
) => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const HEADER_BG = '1a1a2e';
  const HEADER_COLOR = 'ffffff';
  const ROW_ALT = 'f0f0f5';

  // 1. Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '1a1a2e' };
  titleSlide.addText('Rapport de Performance Avancé', {
    x: 0.5, y: 1.5, w: 12, h: 1.2,
    fontSize: 36, bold: true, align: 'center', color: 'ffffff',
    fontFace: 'Arial',
  });
  titleSlide.addText(`Période : ${dateLabel}`, {
    x: 0.5, y: 3.2, w: 12, h: 0.5,
    fontSize: 18, align: 'center', color: 'cccccc', fontFace: 'Arial',
  });
  titleSlide.addText(`Généré le ${format(new Date(), 'PPP', { locale: fr })}`, {
    x: 0.5, y: 3.9, w: 12, h: 0.5,
    fontSize: 14, align: 'center', color: '999999', fontFace: 'Arial',
  });

  // 2. KPIs slide
  const kpiSlide = pptx.addSlide();
  kpiSlide.addText('Indicateurs Clés', {
    x: 0.5, y: 0.3, w: 12, fontSize: 24, bold: true, color: '333333', fontFace: 'Arial',
  });

  const giveRate = globalStats.received > 0 ? `${((globalStats.given / globalStats.received) * 100).toFixed(1)}%` : '0%';
  const missingRate = globalStats.received > 0 ? `${((globalStats.missing / globalStats.received) * 100).toFixed(1)}%` : '0%';

  const kpiLabels = ['Colis reçus', 'En stock', 'Donnés', 'Taux de don', 'Manquants', 'Taux manq.', 'En transfert', 'Mal dirigés'];
  const kpiValues = [
    globalStats.received.toLocaleString(),
    globalStats.active_in_stock.toLocaleString(),
    globalStats.given.toLocaleString(),
    giveRate,
    globalStats.missing.toLocaleString(),
    missingRate,
    globalStats.in_transit.toLocaleString(),
    globalStats.misrouted.toLocaleString(),
  ];

  const kpiRows: PptxGenJS.TableRow[] = [
    kpiLabels.map(l => ({ text: l, options: { bold: true, fontSize: 11, color: HEADER_COLOR, fill: { color: HEADER_BG }, align: 'center' as const } })),
    kpiValues.map(v => ({ text: v, options: { fontSize: 14, bold: true, align: 'center' as const, fill: { color: 'f8f8ff' } } })),
  ];

  kpiSlide.addTable(kpiRows, {
    x: 0.3, y: 1.2, w: 12.5,
    colW: Array(8).fill(12.5 / 8),
    border: { type: 'solid', color: 'CCCCCC', pt: 0.5 },
    autoPage: false,
  });

  // 3. Warehouse performance slide
  const whSlide = pptx.addSlide();
  whSlide.addText('Performance par Dépôt', {
    x: 0.5, y: 0.3, w: 12, fontSize: 24, bold: true, color: '333333', fontFace: 'Arial',
  });

  const whHeader: PptxGenJS.TableRow = [
    ['Dépôt', 'Type', 'Reçus', 'Donnés', 'Taux don', 'Manquants', 'Taux manq.', 'Transit', 'Mal dir.'].map(h => ({
      text: h,
      options: { bold: true, fontSize: 10, color: HEADER_COLOR, fill: { color: HEADER_BG }, align: 'center' as const },
    })),
  ];

  const whRows: PptxGenJS.TableRow[] = warehouseStats.map((s, i) => {
    const gr = s.received > 0 ? `${((s.given / s.received) * 100).toFixed(1)}%` : '0%';
    const mr = s.received > 0 ? `${((s.missing / s.received) * 100).toFixed(1)}%` : '0%';
    const fillColor = i % 2 === 0 ? 'ffffff' : ROW_ALT;
    return [
      { text: s.warehouse_name, options: { fontSize: 10, bold: true, fill: { color: fillColor } } },
      { text: s.warehouse_type, options: { fontSize: 9, fill: { color: fillColor }, align: 'center' as const } },
      { text: s.received.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      { text: s.given.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      { text: gr, options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      { text: s.missing.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      { text: mr, options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      { text: s.in_transit.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      { text: s.misrouted.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
    ];
  });

  whSlide.addTable([...whHeader, ...whRows], {
    x: 0.3, y: 1.2, w: 12.5,
    colW: [2.5, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
    border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
    autoPage: true,
    autoPageRepeatHeader: true,
  });

  // 4. User ranking slide
  if (userRanking.length > 0) {
    const userSlide = pptx.addSlide();
    userSlide.addText('Activité des Utilisateurs', {
      x: 0.5, y: 0.3, w: 12, fontSize: 24, bold: true, color: '333333', fontFace: 'Arial',
    });

    const userHeader: PptxGenJS.TableRow = [
      ['#', 'Utilisateur', 'Total', 'Ajouts', 'Remises', 'Transferts', 'Autres'].map(h => ({
        text: h,
        options: { bold: true, fontSize: 10, color: HEADER_COLOR, fill: { color: HEADER_BG }, align: 'center' as const },
      })),
    ];

    const userRows: PptxGenJS.TableRow[] = userRanking.slice(0, 20).map((u, i) => {
      const adds = u.details['add_parcel'] || 0;
      const gives = u.details['give_to_boutique'] || 0;
      const transfers = (u.details['transfer_initiated'] || 0) + (u.details['transfer_received'] || 0);
      const others = u.total - adds - gives - transfers;
      const fillColor = i % 2 === 0 ? 'ffffff' : ROW_ALT;
      return [
        { text: `${i + 1}`, options: { fontSize: 10, bold: true, fill: { color: fillColor }, align: 'center' as const } },
        { text: u.userName, options: { fontSize: 10, bold: true, fill: { color: fillColor } } },
        { text: u.total.toLocaleString(), options: { fontSize: 10, bold: true, fill: { color: fillColor }, align: 'center' as const } },
        { text: adds.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
        { text: gives.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
        { text: transfers.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
        { text: others.toLocaleString(), options: { fontSize: 10, fill: { color: fillColor }, align: 'center' as const } },
      ];
    });

    userSlide.addTable([...userHeader, ...userRows], {
      x: 0.3, y: 1.2, w: 12.5,
      colW: [0.6, 3, 1.5, 1.5, 1.5, 1.5, 1.5],
      border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
      autoPage: true,
      autoPageRepeatHeader: true,
    });
  }

  const fileName = `rapport_avance_${format(new Date(), 'yyyy-MM-dd')}.pptx`;
  await pptx.writeFile({ fileName });
  return fileName;
};
