import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Activity, Database, ChevronRight, Mail, MessageSquare } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { useTenant } from '@/src/lib/TenantContext';
import { toast } from 'sonner';
import { recordClientIntent } from '@/src/lib/audit';
import { motion } from 'motion/react';

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

interface Buyer {
  id: string;
  name: string;
  buyer_type: 'fix_flip' | 'buy_hold' | 'wholesaler';
  budget_max: number;
  financing: 'cash' | 'pre_approved' | 'financing';
  intent_score: number;
  target_roi?: number;
  preferred_cities: string[];
}

const calculateMatchScore = (deal: Deal, buyer: Buyer) => {
  const budgetMatch = deal.price <= buyer.budget_max ? 1 : 0.5;
  const intentScore = (buyer.intent_score / 5);
  const financingBonus = buyer.financing === 'cash' ? 1 : buyer.financing === 'pre_approved' ? 0.8 : 0.5;
  const dealRoi = deal.roi || 0;
  const roiAlignment = buyer.target_roi ? (dealRoi >= buyer.target_roi ? 1 : dealRoi / buyer.target_roi) : 1;
  const cityMatch = buyer.preferred_cities.some(city => deal.address.toLowerCase().includes(city.toLowerCase())) ? 1 : 0.5;

  const score = (
    budgetMatch * 0.35 +
    intentScore * 0.20 +
    financingBonus * 0.15 +
    roiAlignment * 0.15 +
    cityMatch * 0.15
  ) * 100;

  return Math.round(score);
};

export function SellPillar() {
  const { activeWorkspace } = useTenant();
  const { data: buyers, loading: loadingBuyers } = useRealtimeCollection('buyers', activeWorkspace?.id);
  const { data: deals } = useRealtimeCollection('deals', activeWorkspace?.id);
  const { data: matches, loading: loadingMatches } = useRealtimeCollection('matches', activeWorkspace?.id);

  const [showAddBuyer, setShowAddBuyer] = useState(false);

  const runMatching = async () => {
    if (!activeWorkspace) return;
    if (deals.length === 0 || buyers.length === 0) {
      toast.error("Insufficient data for matching.");
      return;
    }

    // Enforce Plan Limits
    if (activeWorkspace.plan === 'free' && buyers.length >= 5) {
      toast.error("Free tier limit reached (5 buyers). Upgrade to Pro for unlimited buyer capacity.", {
        action: {
          label: 'Upgrade',
          onClick: () => window.dispatchEvent(new CustomEvent('nav-billing'))
        }
      });
      return;
    }

    toast.loading("Running Matching Engine...");
    
    recordClientIntent({
      workspaceId: activeWorkspace.id,
      type: 'MATCHING_ENGINE_INVOKED',
      proposedBy: 'user',
      data: { dealCount: deals.length, buyerCount: buyers.length }
    });
    
    for (const deal of deals) {
      for (const buyer of buyers) {
        const existing = matches.find(m => m.dealId === deal.id && m.buyerId === buyer.id);
        if (existing) continue;

        const score = calculateMatchScore(deal as any, buyer as any);
        if (score > 60) {
          await addDoc(collection(db, 'matches'), {
            workspaceId: activeWorkspace.id,
            dealId: deal.id,
            buyerId: buyer.id,
            score,
            reasons: [
              `Budget alignment within ${(deal.price / buyer.budget_max * 100).toFixed(0)}%`,
              `${buyer.financing.toUpperCase()} financing bonus`,
              `Location match for ${buyer.preferred_cities[0]}`
            ],
            createdAt: serverTimestamp()
          });
        }
      }
    }
    toast.dismiss();
    toast.success("Matching Engine Complete");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] h-full">
      {/* Buyers List */}
      <section className="border-r border-border flex flex-col bg-card/30">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="font-display font-bold text-sm uppercase tracking-tight">Buyer Intelligence</h3>
          <Button variant="ghost" size="icon" className="text-accent" onClick={() => setShowAddBuyer(true)}>
            <Plus size={18} />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {loadingBuyers ? (
              <div className="py-12 text-center font-mono text-[10px] text-muted">Scanning Network...</div>
            ) : buyers.length === 0 ? (
              <div className="py-12 text-center font-mono text-[10px] text-muted">No buyers found.</div>
            ) : buyers.map((buyer) => (
              <div key={buyer.id} className="terminal-card p-4 space-y-3 cursor-pointer group">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-xs group-hover:text-gold transition-colors">{buyer.name}</span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${i < buyer.intent_score ? 'bg-accent' : 'bg-border'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted">Budget:</span>
                  <span className="text-gold">${(buyer.budget_max / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-border text-muted uppercase">{buyer.financing}</Badge>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-border text-muted uppercase">{buyer.buyer_type}</Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>

      {/* Matching Engine */}
      <section className="flex flex-col">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Activity className="text-accent" size={18} />
            <h3 className="font-display font-bold text-sm uppercase tracking-tight">Live Matching Engine</h3>
          </div>
          <Button className="bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-[10px]" onClick={runMatching}>
            Initialize Match
          </Button>
        </div>
        <ScrollArea className="flex-1 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingMatches ? (
              <div className="col-span-2 py-24 text-center font-mono text-xs text-muted">Computing Probabilities...</div>
            ) : matches.length === 0 ? (
              <div className="col-span-2 py-24 text-center space-y-4">
                <Database className="w-12 h-12 mx-auto text-muted opacity-20" />
                <p className="font-mono text-xs text-muted">Awaiting match initialization.</p>
              </div>
            ) : [...matches].sort((a, b) => b.score - a.score).map((match) => {
              const deal = deals.find(d => d.id === match.dealId);
              const buyer = buyers.find(b => b.id === match.buyerId);
              if (!deal || !buyer) return null;

              return (
                <div key={match.id} className="terminal-card p-6 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-border" />
                        <circle 
                          cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="3" 
                          className={match.score > 85 ? 'text-neon-cyan' : 'text-accent'}
                          strokeDasharray={125.6}
                          strokeDashoffset={125.6 * (1 - match.score / 100)}
                        />
                      </svg>
                      <span className="absolute font-mono font-bold text-[10px]">{match.score}%</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="meta-tag">Property</p>
                      <p className="font-bold text-sm">{deal.address}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="meta-tag">Matched Buyer</p>
                      <p className="font-bold text-sm text-gold">{buyer.name}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="meta-tag">Match Logic</p>
                    <ul className="space-y-1">
                      {match.reasons.map((reason, i) => (
                        <li key={i} className="text-[10px] text-muted flex items-center gap-2">
                          <ChevronRight size={10} className="text-accent" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button className="w-full bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest border border-border">
                    Contact Buyer
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </section>

      {/* Market Velocity */}
      <section className="border-l border-border flex flex-col bg-card/30">
        <div className="p-6 border-b border-border">
          <h3 className="font-display font-bold text-sm uppercase tracking-tight">Market Velocity</h3>
        </div>
        <div className="p-6 space-y-8">
          <div className="space-y-4">
            <p className="meta-tag">Distribution Channels</p>
            {[
              { icon: Mail, label: 'Email Blast', status: 'Ready' },
              { icon: MessageSquare, label: 'SMS Push', status: 'Ready' },
              { icon: Database, label: 'CRM Sync', status: 'Active' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 terminal-card bg-white/5">
                <div className="flex items-center gap-3">
                  <item.icon size={14} className="text-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                </div>
                <span className="text-[9px] font-mono text-muted">{item.status}</span>
              </div>
            ))}
          </div>

          <div className="p-4 border border-accent/20 bg-accent/5 rounded space-y-3">
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Batch Action</p>
            <p className="text-[10px] text-muted leading-relaxed">Distribute all pending matches to verified buyers across active channels.</p>
            <Button className="w-full bg-accent text-background hover:bg-accent/90 text-[10px] font-bold uppercase tracking-widest" onClick={() => toast.success("Distribution cycle initiated")}>
              Distribute All
            </Button>
          </div>
        </div>
      </section>

      {/* Add Buyer Modal */}
      {showAddBuyer && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="terminal-card w-full max-w-md p-8 space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-display font-bold text-xl uppercase tracking-tight">Intake New Buyer</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddBuyer(false)}>×</Button>
            </div>

            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              if (!activeWorkspace) return;
              const formData = new FormData(e.currentTarget);
              await addDoc(collection(db, 'buyers'), {
                workspaceId: activeWorkspace.id,
                name: formData.get('name'),
                buyer_type: formData.get('type'),
                budget_max: Number(formData.get('budget')),
                financing: formData.get('financing'),
                intent_score: Number(formData.get('intent')),
                preferred_cities: [formData.get('city')],
                createdAt: serverTimestamp()
              });
              setShowAddBuyer(false);
              toast.success("Buyer added to network");
            }}>
              <div className="space-y-2">
                <label className="meta-tag">Full Name</label>
                <Input name="name" required className="bg-white/5 border-border text-xs" placeholder="John Investor" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="meta-tag">Buyer Type</label>
                  <select name="type" className="w-full bg-white/5 border border-border rounded p-2 text-xs">
                    <option value="fix_flip">Fix & Flip</option>
                    <option value="buy_hold">Buy & Hold</option>
                    <option value="wholesaler">Wholesaler</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="meta-tag">Financing</label>
                  <select name="financing" className="w-full bg-white/5 border border-border rounded p-2 text-xs">
                    <option value="cash">Cash</option>
                    <option value="pre_approved">Pre-Approved</option>
                    <option value="financing">Financing</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="meta-tag">Budget Max ($)</label>
                  <Input name="budget" type="number" required className="bg-white/5 border-border text-xs" placeholder="500000" />
                </div>
                <div className="space-y-2">
                  <label className="meta-tag">Intent Score (1-5)</label>
                  <Input name="intent" type="number" min="1" max="5" required className="bg-white/5 border-border text-xs" placeholder="5" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="meta-tag">Preferred City</label>
                <Input name="city" required className="bg-white/5 border-border text-xs" placeholder="Los Angeles" />
              </div>
              <Button type="submit" className="w-full bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-[10px] h-12">
                Register Buyer
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
