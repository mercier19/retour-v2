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

const cell = (text: string, opts: Record<string, any> = {}): PptxGenJS.TableCell => ({
  text,
  options: { fontSize: 10, align: 'center' as const, ...opts },
});

const headerCell = (text: string): PptxGenJS.TableCell => cell(text, {
  bold: true, fontSize: 10, color: 'ffffff', fill: { color: '1a1a2e' },
});

export const generateAdvancedReport = async (
  globalStats: GlobalStats,
  warehouseStats: WarehouseStat[],
  userRanking: UserRankingItem[],
  dateLabel: string,
) => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const ROW_ALT = 'f0f0f5';

  // 1. Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '1a1a2e' };
  titleSlide.addText('Rapport de Performance Avancé', {
    x: 0.5, y: 1.5, w: 12, h: 1.2,
    fontSize: 36, bold: true, align: 'center', color: 'ffffff', fontFace: 'Arial',
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

  const kpiRows: PptxGenJS.TableRow[] = [
    ['Colis reçus', 'En stock', 'Donnés', 'Taux de don', 'Manquants', 'Taux manq.', 'En transfert', 'Mal dirigés'].map(l => headerCell(l)),
    [
      globalStats.received.toLocaleString(), globalStats.active_in_stock.toLocaleString(),
      globalStats.given.toLocaleString(), giveRate, globalStats.missing.toLocaleString(),
      missingRate, globalStats.in_transit.toLocaleString(), globalStats.misrouted.toLocaleString(),
    ].map(v => cell(v, { fontSize: 14, bold: true, fill: { color: 'f8f8ff' } })),
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

  const whRows: PptxGenJS.TableRow[] = [
    ['Dépôt', 'Type', 'Reçus', 'Donnés', 'Taux don', 'Manquants', 'Taux manq.', 'Transit', 'Mal dir.'].map(h => headerCell(h)),
    ...warehouseStats.map((s, i) => {
      const gr = s.received > 0 ? `${((s.given / s.received) * 100).toFixed(1)}%` : '0%';
      const mr = s.received > 0 ? `${((s.missing / s.received) * 100).toFixed(1)}%` : '0%';
      const fill = { color: i % 2 === 0 ? 'ffffff' : ROW_ALT };
      return [
        cell(s.warehouse_name, { bold: true, fill, align: 'left' }),
        cell(s.warehouse_type, { fontSize: 9, fill }),
        cell(s.received.toLocaleString(), { fill }),
        cell(s.given.toLocaleString(), { fill }),
        cell(gr, { fill }),
        cell(s.missing.toLocaleString(), { fill }),
        cell(mr, { fill }),
        cell(s.in_transit.toLocaleString(), { fill }),
        cell(s.misrouted.toLocaleString(), { fill }),
      ];
    }),
  ];

  whSlide.addTable(whRows, {
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

    const userRows: PptxGenJS.TableRow[] = [
      ['#', 'Utilisateur', 'Total', 'Ajouts', 'Remises', 'Transferts', 'Autres'].map(h => headerCell(h)),
      ...userRanking.slice(0, 20).map((u, i) => {
        const adds = u.details['add_parcel'] || 0;
        const gives = u.details['give_to_boutique'] || 0;
        const transfers = (u.details['transfer_initiated'] || 0) + (u.details['transfer_received'] || 0);
        const others = u.total - adds - gives - transfers;
        const fill = { color: i % 2 === 0 ? 'ffffff' : ROW_ALT };
        return [
          cell(`${i + 1}`, { bold: true, fill }),
          cell(u.userName, { bold: true, fill, align: 'left' }),
          cell(u.total.toLocaleString(), { bold: true, fill }),
          cell(adds.toLocaleString(), { fill }),
          cell(gives.toLocaleString(), { fill }),
          cell(transfers.toLocaleString(), { fill }),
          cell(others.toLocaleString(), { fill }),
        ];
      }),
    ];

    userSlide.addTable(userRows, {
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
