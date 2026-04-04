import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ImportResult {
  row: number;
  label: string;
  success: boolean;
  error?: string;
}

interface ExcelImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  templateColumns: string[];
  templateFileName: string;
  onImport: (rows: Record<string, any>[]) => Promise<ImportResult[]>;
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  open, onOpenChange, title, templateColumns, templateFileName, onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([templateColumns]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, templateFileName);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResults(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (rows.length === 0) {
        toast.error('Le fichier est vide');
        setImporting(false);
        return;
      }

      const importResults = await onImport(rows);
      setResults(importResults);

      const successCount = importResults.filter(r => r.success).length;
      const errorCount = importResults.filter(r => !r.success).length;
      if (errorCount === 0) toast.success(`${successCount} ligne(s) importée(s) avec succès`);
      else toast.warning(`${successCount} succès, ${errorCount} erreur(s)`);
    } catch (err: any) {
      toast.error(`Erreur de lecture : ${err.message}`);
    }
    setImporting(false);
  };

  const reset = () => {
    setFile(null);
    setResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full gap-2">
            <Download className="w-4 h-4" /> Télécharger le modèle vide
          </Button>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fichier Excel rempli</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResults(null); }}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          {results && (
            <div className="space-y-2 border rounded-md p-3 max-h-60 overflow-y-auto">
              <div className="flex gap-2 mb-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" /> {results.filter(r => r.success).length} succès
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="w-3 h-3 text-destructive" /> {results.filter(r => !r.success).length} erreurs
                </Badge>
              </div>
              {results.filter(r => !r.success).map((r, i) => (
                <div key={i} className="text-xs flex items-start gap-2 text-destructive">
                  <span className="font-mono whitespace-nowrap">Ligne {r.row}:</span>
                  <span>{r.label} — {r.error}</span>
                </div>
              ))}
              {results.every(r => r.success) && (
                <p className="text-xs text-green-600">Toutes les lignes ont été importées avec succès.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={handleImport} disabled={!file || importing} className="gap-1">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Import en cours...' : 'Importer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExcelImportModal;
