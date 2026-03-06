import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { dbService } from '../lib/db';
import { Download, FileText, Map as MapIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function Export() {
  const { profile } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!profile) return;
    setExporting(true);
    try {
      const { sightings } = await dbService.getSightings(profile.uid, undefined, 10000); // Get all
      
      const headers = ['Datum', 'Druh (CZ)', 'Druh (Lat)', 'Lat', 'Lon', 'Grid', 'Vzácnost', 'Počet', 'Poznámka', 'Počet fotek'];
      const rows = sightings.map(s => [
        s.capturedAt.toDate().toISOString(),
        s.species.commonName,
        s.species.scientificName || '',
        s.location.privacy === 'exact' ? s.location.lat || '' : '',
        s.location.privacy === 'exact' ? s.location.lon || '' : '',
        s.location.gridId || '',
        s.rarity.label,
        s.count || '',
        `"${(s.notes || '').replace(/"/g, '""')}"`,
        s.photos.length
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `houbarsky_denik_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV exportováno');
    } catch (err) {
      toast.error('Chyba při exportu');
    } finally {
      setExporting(false);
    }
  };

  const handleExportGPX = async () => {
    if (!profile) return;
    setExporting(true);
    try {
      const { sightings } = await dbService.getSightings(profile.uid, undefined, 10000);
      
      const waypoints = sightings
        .filter(s => s.location.lat && s.location.lon && s.location.privacy === 'exact')
        .map(s => `
  <wpt lat="${s.location.lat}" lon="${s.location.lon}">
    <name>${s.species.commonName}</name>
    <desc>${s.notes || ''} [${s.rarity.label}]</desc>
    <time>${s.capturedAt.toDate().toISOString()}</time>
  </wpt>`).join('');

      const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Houbarsky Denik">
${waypoints}
</gpx>`;

      const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `houbarsky_denik_${new Date().toISOString().split('T')[0]}.gpx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('GPX exportováno');
    } catch (err) {
      toast.error('Chyba při exportu');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-stone-800">Export dat</h2>
        <p className="text-stone-500">Stáhněte si svá data pro zálohu nebo zpracování v jiných aplikacích.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-bold text-stone-800 mb-2">Tabulka (CSV)</h3>
          <p className="text-sm text-stone-500 mb-6 flex-1">
            Všechny nálezy ve formátu pro Excel nebo Google Sheets. Obsahuje všechny detaily kromě samotných fotek.
          </p>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-3 rounded-xl font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Stáhnout CSV
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
            <MapIcon size={32} />
          </div>
          <h3 className="text-lg font-bold text-stone-800 mb-2">Mapa (GPX)</h3>
          <p className="text-sm text-stone-500 mb-6 flex-1">
            Body na mapě pro import do mapových aplikací (Locus, Mapy.cz). Obsahuje pouze nálezy s přesnou polohou.
          </p>
          <button
            onClick={handleExportGPX}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-3 rounded-xl font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Stáhnout GPX
          </button>
        </div>
      </div>
    </div>
  );
}
