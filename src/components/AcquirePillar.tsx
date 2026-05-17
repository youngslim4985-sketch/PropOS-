import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Target } from 'lucide-react';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { useTenant } from '@/src/lib/TenantContext';
import { toast } from 'sonner';
import { ActionType, logUsage } from '@/src/lib/usage';
import { DealMap } from './DealMap';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// --- Types ---
interface Deal {
  id: string;
  title: string;
  address: string;
  price: number;
  arv: number;
  rehab: number;
  status: 'new' | 'analyzing' | 'offer-sent' | 'closed';
  score: number;
  roi: number;
  lat?: number;
  lng?: number;
}

const calculateDealScore = (deal: Partial<Deal>) => {
  if (!deal.price || !deal.arv || !deal.rehab) return 0;
  const roi = ((deal.arv - deal.price - deal.rehab) / (deal.price + deal.rehab)) * 100;
  const valueSpread = (deal.arv / deal.price) * 30;
  const roiPotential = (roi / 30) * 25; 
  const rehabEfficiency = (1 - deal.rehab / deal.price) * 20;
  const locationWeight = 15; 
  const typeWeight = 10; 
  return Math.min(100, Math.round(valueSpread + roiPotential + rehabEfficiency + locationWeight + typeWeight));
};

export function AcquirePillar() {
  const { activeWorkspace, activeRole } = useTenant();
  const { data: deals, loading } = useRealtimeCollection('deals', activeWorkspace?.id);
  const { data: usageLogs } = useRealtimeCollection('usageLogs', activeWorkspace?.id);
  const isViewer = activeRole === 'viewer';

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchStatus = statusFilter === 'all' || deal.status === statusFilter;
      const matchPrice = !maxPrice || deal.price <= parseInt(maxPrice);
      return matchStatus && matchPrice;
    });
  }, [deals, statusFilter, maxPrice]);

  const runScan = () => {
    if (!activeWorkspace || !auth.currentUser) return;
    if (isViewer) {
      toast.error("Read-only access. Privilege escalation required.");
      return;
    }

    // Enforce Plan Limits
    const scanCount = usageLogs.filter(log => log.actionType === ActionType.AI_DEAL_SCAN).length;
    if (activeWorkspace.plan === 'free' && scanCount >= 3) {
      toast.error("Free tier limit reached (3 scans). Upgrade to Pro for unlimited scans.", {
        action: {
          label: 'Upgrade',
          onClick: () => window.dispatchEvent(new CustomEvent('nav-billing'))
        }
      });
      return;
    }

    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          // Log usage for billing
          await logUsage(activeWorkspace.id, auth.currentUser!.uid, ActionType.AI_DEAL_SCAN);
          
          setTimeout(() => {
            const newDeals = [
              { title: "Hollywood Hills Fixer", address: "123 Main St, LA", price: 780000, arv: 1150000, rehab: 125000, lat: 34.1015, lng: -118.3267 },
              { title: "Silver Lake Triplex", address: "456 Oak Ave, LA", price: 1250000, arv: 1610000, rehab: 85000, lat: 34.0869, lng: -118.2702 },
              { title: "Downtown Loft Conversion", address: "789 Pine Rd, LA", price: 425000, arv: 665000, rehab: 135000, lat: 34.0407, lng: -118.2468 },
            ];
            newDeals.forEach(d => {
              const score = calculateDealScore(d);
              const roi = ((d.arv - d.price - d.rehab) / (d.price + d.rehab)) * 100;
              addDoc(collection(db, 'deals'), {
                ...d,
                workspaceId: activeWorkspace.id,
                score,
                roi,
                status: 'new',
                createdAt: serverTimestamp()
              });
            });
            resolve(true);
          }, 2000);
        } catch (error) {
          reject(error);
        }
      }),
      {
        loading: 'Scanning market for distressed assets...',
        success: () => `Found 3 new high-potential deals (${3 - scanCount - 1} free scans left)`,
        error: 'Scan failed'
      }
    );
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h2 className="font-display font-black text-3xl uppercase tracking-tight">DealFlow Pipeline</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[8px] font-bold tracking-widest bg-accent/10 border-accent/20 text-accent">AI_SCANNER_READY</Badge>
            <p className="meta-tag">Acquisition Engine Active</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {!isViewer && (
            <Button className="bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-[10px]" onClick={runScan}>
              <Search size={14} className="mr-2" /> Run DealFlow AI
            </Button>
          )}
        </div>
      </div>

      {/* Control Layer: Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
        <div className="flex-1 min-w-[200px] flex items-center gap-4">
          <div className="space-y-1.5 flex-1">
            <p className="text-[8px] font-bold text-muted uppercase tracking-widest ml-1">Status Filter</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-black/20 border-white/10 text-[10px] uppercase font-bold">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Analyze All</SelectItem>
                <SelectItem value="new">New Opportunity</SelectItem>
                <SelectItem value="analyzing">Under Review</SelectItem>
                <SelectItem value="offer-sent">Offer Sent</SelectItem>
                <SelectItem value="closed">Closed Deal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1">
            <p className="text-[8px] font-bold text-muted uppercase tracking-widest ml-1">Capital Threshold (Max Price)</p>
            <Input 
              type="number" 
              placeholder="e.g. 500000" 
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="bg-black/20 border-white/10 text-[10px] font-mono h-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 py-2 border-l border-white/10">
          <div className="text-right">
            <p className="text-[8px] font-bold text-muted uppercase tracking-widest">Active Results</p>
            <p className="text-xl font-display font-black text-neon-cyan">{filteredDeals.length}</p>
          </div>
        </div>
      </div>

      {/* Map Layer */}
      <DealMap deals={filteredDeals} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-24 text-center font-mono text-xs text-muted animate-pulse">
            <Search className="w-8 h-8 mx-auto mb-4 opacity-20 animate-spin" />
            Synchronizing with Acquisition Ledger...
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="col-span-2 py-24 text-center space-y-4 terminal-card">
            <Target className="w-12 h-12 mx-auto text-muted opacity-20" />
            <p className="font-mono text-xs text-muted uppercase">No deals matched the current heuristic filters.</p>
            {!isViewer && <Button variant="outline" size="sm" className="font-bold text-[10px] uppercase tracking-widest" onClick={runScan}>Initialize Scan</Button>}
          </div>
        ) : filteredDeals.map((deal) => (
          <div key={deal.id} className="terminal-card p-6 flex gap-6 group hover:border-accent/40 transition-all">
            <div className="flex-1 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg group-hover:text-gold transition-colors">{deal.title || deal.address}</h4>
                  <p className="text-[10px] font-mono text-muted uppercase tracking-tighter mb-1">{deal.address}</p>
                  <Badge variant="outline" className={`text-[8px] uppercase ${
                    deal.status === 'new' ? 'border-neon-cyan text-neon-cyan' :
                    deal.status === 'closed' ? 'border-green-400 text-green-400' :
                    'border-muted text-muted'
                  }`}>
                    {deal.status.replace(/-/g, ' ')}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xl font-mono font-bold text-gold">${(deal.price || 0).toLocaleString()}</p>
                  <p className="meta-tag">Purchase Price</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-lg border border-white/5">
                <div>
                  <p className="meta-tag mb-1">ARV</p>
                  <p className="font-mono font-bold text-sm text-white/90">${(deal.arv || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="meta-tag mb-1">Rehab</p>
                  <p className="font-mono font-bold text-sm text-red-400 opacity-80">${(deal.rehab || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="meta-tag mb-1">ROI Est.</p>
                  <p className="font-mono font-bold text-sm text-neon-cyan">+{deal.roi?.toFixed(1)}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {!isViewer && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[9px] uppercase font-bold tracking-widest text-muted hover:text-red-400" 
                      onClick={() => deleteDoc(doc(db, 'deals', deal.id))}
                    >
                      Discard
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-[9px] uppercase font-bold tracking-widest border-accent/20 text-accent hover:bg-accent hover:text-background">Deeper Analysis</Button>
                </div>
                <Button className="bg-white text-background hover:bg-gold transition-colors text-[9px] uppercase font-bold tracking-widest px-6">
                  Match Buyers
                </Button>
              </div>
            </div>

            <div className="w-24 flex flex-col items-center justify-center border-l border-border pl-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_8px_rgba(var(--accent),0.3)]">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                  <circle 
                    cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" 
                    className="text-accent transition-all duration-1000"
                    strokeDasharray={175.9}
                    strokeDashoffset={175.9 * (1 - (deal.score || 0) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-display font-black text-sm">{deal.score}</span>
              </div>
              <p className="meta-tag mt-2">Deal Score</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
