import { Button } from '@/components/ui/button';
import { Search, Target } from 'lucide-react';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { useTenant } from '@/src/lib/TenantContext';
import { toast } from 'sonner';
import { ActionType, logUsage } from '@/src/lib/usage';

// --- Types ---
interface Deal {
  id: string;
  address: string;
  price: number;
  arv: number;
  rehab: number;
  status: 'new' | 'analyzing' | 'matched';
  score?: number;
  roi?: number;
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
              { address: "123 Main St, LA", price: 180000, arv: 275000, rehab: 45000 },
              { address: "456 Oak Ave, LA", price: 325000, arv: 410000, rehab: 65000 },
              { address: "789 Pine Rd, LA", price: 95000, arv: 165000, rehab: 35000 },
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
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="font-display font-black text-3xl uppercase tracking-tight">DealFlow Pipeline</h2>
          <p className="meta-tag">Acquisition Engine Active</p>
        </div>
        {!isViewer && (
          <Button className="bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-[10px]" onClick={runScan}>
            <Search size={14} className="mr-2" /> Run DealFlow AI
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-24 text-center font-mono text-xs text-muted">Analyzing Market...</div>
        ) : deals.length === 0 ? (
          <div className="col-span-2 py-24 text-center space-y-4 terminal-card">
            <Target className="w-12 h-12 mx-auto text-muted opacity-20" />
            <p className="font-mono text-xs text-muted">No active deals in pipeline.</p>
            {!isViewer && <Button variant="outline" size="sm" onClick={runScan}>Initialize Scan</Button>}
          </div>
        ) : deals.map((deal) => (
          <div key={deal.id} className="terminal-card p-6 flex gap-6 group">
            <div className="flex-1 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg group-hover:text-gold transition-colors">{deal.address}</h4>
                  <span className="text-[10px] uppercase font-bold text-muted tracking-widest">{deal.status}</span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-mono font-bold text-gold">${(deal.price || 0).toLocaleString()}</p>
                  <p className="meta-tag">Purchase Price</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded">
                <div>
                  <p className="meta-tag mb-1">ARV</p>
                  <p className="font-mono font-bold text-sm">${(deal.arv || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="meta-tag mb-1">Rehab</p>
                  <p className="font-mono font-bold text-sm text-red-400">${(deal.rehab || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="meta-tag mb-1">ROI</p>
                  <p className="font-mono font-bold text-sm text-neon-cyan">+{deal.roi?.toFixed(1)}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {!isViewer && <Button variant="outline" size="sm" className="text-[9px] uppercase font-bold tracking-widest" onClick={() => deleteDoc(doc(db, 'deals', deal.id))}>Discard</Button>}
                  <Button variant="outline" size="sm" className="text-[9px] uppercase font-bold tracking-widest border-accent text-accent hover:bg-accent hover:text-background">Analyze</Button>
                </div>
                <Button className="bg-white text-background hover:bg-white/90 text-[9px] uppercase font-bold tracking-widest">
                  → BuyerFlow
                </Button>
              </div>
            </div>

            <div className="w-24 flex flex-col items-center justify-center border-l border-border pl-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-border" />
                  <circle 
                    cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" 
                    className="text-accent transition-all duration-1000"
                    strokeDasharray={175.9}
                    strokeDashoffset={175.9 * (1 - (deal.score || 0) / 100)}
                  />
                </svg>
                <span className="absolute font-mono font-bold text-sm">{deal.score}</span>
              </div>
              <p className="meta-tag mt-2">Deal Score</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
