import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  TrendingUp, 
  Users, 
  Search, 
  Plus, 
  MessageSquare, 
  Wrench, 
  DollarSign,
  ArrowUpRight,
  Zap,
  Target,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { db, auth } from '@/src/lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { matchDealToBuyer } from '@/src/lib/gemini';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('manage');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Welcome to PropOS");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to sign in with Google.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info("Signed out successfully");
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center p-6">
        <Toaster position="top-right" richColors />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-12 text-center"
        >
          <div className="space-y-4">
            <div className="font-serif text-6xl font-black tracking-tighter">
              PropOS<span className="text-accent font-light ml-1">vNext</span>
            </div>
            <p className="text-muted-foreground font-serif italic text-lg">
              The 3-Sided Real Estate Operating System.
            </p>
          </div>

          <div className="border border-border p-10 space-y-8 bg-white shadow-2xl">
            <div className="space-y-2">
              <ShieldCheck className="w-12 h-12 mx-auto text-accent" />
              <h2 className="text-2xl font-black tracking-tight uppercase">Secure Access</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Authorized Personnel Only</p>
            </div>
            
            <Button 
              onClick={handleLogin}
              className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Sign in with Google
            </Button>
            
            <p className="text-[10px] text-muted-foreground font-serif italic leading-relaxed">
              By accessing this system, you agree to the PropOS terms of service and liquidity distribution protocols.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <Dashboard user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />;
}

function Dashboard({ user, activeTab, setActiveTab, onLogout }: any) {
  const { data: properties, loading: loadingProps } = useRealtimeCollection('properties');
  const { data: deals, loading: loadingDeals } = useRealtimeCollection('deals');
  const { data: buyers, loading: loadingBuyers } = useRealtimeCollection('buyers');
  const { data: matches, loading: loadingMatches } = useRealtimeCollection('matches');

  const [isMatching, setIsMatching] = useState(false);

  const runMatching = async () => {
    if (deals.length === 0 || buyers.length === 0) {
      toast.error("Need both deals and buyers to run matching.");
      return;
    }

    setIsMatching(true);
    toast.info("AI Matching Engine started...");

    try {
      for (const deal of deals) {
        for (const buyer of buyers) {
          // Check if match already exists
          const existingMatch = matches.find((m: any) => m.dealId === deal.id && m.buyerId === buyer.id);
          if (existingMatch) continue;

          const result = await matchDealToBuyer(deal, buyer);
          if (result.score > 70) {
            await addDoc(collection(db, 'matches'), {
              dealId: deal.id,
              buyerId: buyer.id,
              dealTitle: deal.title,
              buyerName: buyer.name,
              score: result.score,
              reasons: result.reasons,
              status: 'pending',
              createdAt: serverTimestamp()
            });
            toast.success(`Match found: ${deal.title} + ${buyer.name} (${result.score}%)`);
          }
        }
      }
      toast.success("Matching cycle complete.");
    } catch (error) {
      console.error("Matching error:", error);
      toast.error("Matching engine failed.");
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background flex flex-col">
      <Toaster position="top-right" richColors />
      
      {/* Editorial Header */}
      <header className="px-12 py-10 flex justify-between items-end border-b border-border bg-background sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="font-serif text-4xl font-black tracking-tighter">
            PropOS<span className="text-accent font-light ml-1">vNext</span>
          </div>
          <div className="h-8 w-px bg-border hidden md:block" />
          <div className="hidden md:flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <div className="text-[10px] uppercase tracking-widest font-bold">
              <p className="leading-none">{user.displayName}</p>
              <p className="text-muted-foreground leading-none mt-1 opacity-50">Account ID: {user.uid.slice(0, 8)}</p>
            </div>
          </div>
        </div>
        
        <nav className="flex gap-12 items-center">
          {[
            { id: 'manage', label: 'Manage' },
            { id: 'acquire', label: 'Acquire' },
            { id: 'sell', label: 'Sell' },
            { id: 'pricing', label: 'Pricing' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-xs uppercase tracking-[0.15em] font-bold relative pb-2 transition-colors ${
                activeTab === item.id 
                  ? 'text-foreground nav-item-active' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
          <Button variant="ghost" size="icon" onClick={onLogout} className="text-muted-foreground hover:text-foreground ml-4">
            <LogOut size={18} />
          </Button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-[1440px] mx-auto min-h-[calc(100vh-160px)]">
          <div className="px-12 py-4 flex justify-end gap-4">
            <Button size="sm" variant="outline" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => {
              // Quick add mock data for testing
              if (activeTab === 'manage') {
                addDoc(collection(db, 'properties'), {
                  address: 'New Property ' + Math.floor(Math.random() * 1000),
                  units: 10,
                  occupancy: 90,
                  noi: 5000,
                  status: 'active',
                  ownerId: user.uid,
                  createdAt: serverTimestamp()
                });
              } else if (activeTab === 'acquire') {
                addDoc(collection(db, 'deals'), {
                  title: 'New Deal ' + Math.floor(Math.random() * 1000),
                  address: 'Market St',
                  price: 200000,
                  arv: 300000,
                  score: 85,
                  status: 'new',
                  createdAt: serverTimestamp()
                });
              } else if (activeTab === 'sell') {
                addDoc(collection(db, 'buyers'), {
                  name: 'Investor ' + Math.floor(Math.random() * 1000),
                  email: 'investor@example.com',
                  budget: 500000,
                  strategy: 'buy-and-hold',
                  intentScore: 80,
                  createdAt: serverTimestamp()
                });
              }
            }}>
              <Plus className="w-3 h-3 mr-2" />
              Quick Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </Button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {activeTab === 'manage' && <ManageView properties={properties} loading={loadingProps} />}
              {activeTab === 'acquire' && <AcquireView deals={deals} loading={loadingDeals} />}
              {activeTab === 'sell' && <SellView buyers={buyers} matches={matches} loading={loadingBuyers || loadingMatches} onRunMatching={runMatching} isMatching={isMatching} />}
              {activeTab === 'pricing' && <PricingView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Editorial Footer */}
      <footer className="h-16 border-t border-border px-12 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground bg-background">
        <div className="flex items-center gap-6">
          <span>Operating System v2.0.44</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span>Network Effect Status: Active</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span>Liquidity Rate: 84.2%</span>
          <span className="font-mono">© 2026 PROPOS CORE</span>
        </div>
      </footer>
    </div>
  );
}

function ManageView({ properties, loading }: any) {
  const totalNoi = properties.reduce((acc: number, p: any) => acc + (p.noi || 0), 0);
  const avgOccupancy = properties.length > 0 
    ? (properties.reduce((acc: number, p: any) => acc + (p.occupancy || 0), 0) / properties.length).toFixed(1)
    : 0;

  return (
    <div className="p-12 space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <StatCard title="Total Monthly Profit (NOI)" value={`$${totalNoi.toLocaleString()}`} trend="+12.4%" icon={DollarSign} />
        <StatCard title="Occupancy Rate" value={`${avgOccupancy}%`} trend="-1.2%" icon={Users} />
        <StatCard title="Maintenance Tasks" value="4" trend="Stable" icon={Wrench} />
      </div>

      <div className="space-y-6">
        <div className="border-b border-border pb-4">
          <span className="meta-tag">Operations Layer</span>
          <h2 className="text-3xl font-black tracking-tight mt-1">Property Portfolio</h2>
          <p className="text-muted-foreground font-serif italic text-sm mt-2">
            Monitor your rental income and occupancy across all your properties.
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property Address</th>
                <th className="py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Units</th>
                <th className="py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Occupancy</th>
                <th className="py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monthly Profit</th>
                <th className="py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center font-serif italic opacity-50">Loading your properties...</td></tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center space-y-4">
                    <Building2 className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                    <p className="font-serif italic text-muted-foreground">Your portfolio is currently empty.</p>
                    <p className="text-xs uppercase tracking-widest font-bold text-accent">Click "Quick Add" above to see how it works</p>
                  </td>
                </tr>
              ) : properties.map((prop: any) => (
                <tr key={prop.id} className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <td className="py-6 font-serif text-lg font-medium">{prop.address}</td>
                  <td className="py-6 font-mono text-sm">{prop.units}</td>
                  <td className="py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border w-24 relative">
                        <div 
                          className="absolute inset-y-0 left-0 bg-foreground transition-all h-px" 
                          style={{ width: `${prop.occupancy}%` }} 
                        />
                      </div>
                      <span className="font-mono text-[10px]">{prop.occupancy}%</span>
                    </div>
                  </td>
                  <td className="py-6 font-mono text-sm">${(prop.noi || 0).toLocaleString()}</td>
                  <td className="py-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-secondary border border-border">
                      {prop.status}
                    </span>
                  </td>
                  <td className="py-6 text-right">
                    <Button variant="ghost" size="sm" className="font-serif italic text-accent hover:text-accent hover:bg-transparent p-0">
                      View Details →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AcquireView({ deals, loading }: any) {
  return (
    <div className="p-12 space-y-12">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <span className="meta-tag">Acquisition Engine</span>
          <h2 className="text-4xl font-black tracking-tight mt-1">DealFlow Pipeline</h2>
          <p className="text-muted-foreground font-serif italic text-sm mt-2">
            Find and analyze new investment properties with AI-powered scoring.
          </p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">Filter Deals</Button>
          <Button size="sm" className="bg-foreground text-background font-bold uppercase tracking-widest text-[10px]">Scan for Opportunities</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {loading ? (
          <div className="col-span-2 py-24 text-center font-serif italic opacity-50">Searching for deals...</div>
        ) : deals.length === 0 ? (
          <div className="col-span-2 py-24 text-center space-y-4">
            <Search className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
            <p className="font-serif italic text-muted-foreground">No investment opportunities found yet.</p>
            <p className="text-xs uppercase tracking-widest font-bold text-accent">Try clicking "Scan Market" to find new deals</p>
          </div>
        ) : deals.map((deal: any) => (
          <div key={deal.id} className="group cursor-pointer border-b border-border pb-8 hover:border-accent transition-colors">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-serif font-bold group-hover:text-accent transition-colors">{deal.title}</h3>
                <p className="text-muted-foreground font-serif italic text-sm mt-1">{deal.address}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-bold">${(deal.price || 0).toLocaleString()}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Purchase Price</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Est. Value (ARV)</p>
                <p className="font-bold font-mono text-lg">${(deal.arv || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Profit Potential</p>
                <p className="font-bold font-mono text-lg text-accent">
                  +{deal.price > 0 ? (((deal.arv - deal.price) / deal.price) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Match Score</p>
                <p className="font-bold font-mono text-2xl">{deal.score || 'N/A'}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-secondary border border-border">
                {deal.status}
              </span>
              <Button variant="ghost" size="sm" className="font-serif italic text-accent hover:text-accent hover:bg-transparent p-0 group-hover:translate-x-1 transition-transform">
                View Analysis →
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SellView({ buyers, matches, loading, onRunMatching, isMatching }: any) {
  const latestMatch = matches[matches.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] h-full min-h-[calc(100vh-160px)]">
      {/* Col 1: Buyer Intelligence */}
      <section className="border-r border-border p-10 flex flex-col">
        <div className="mb-10">
          <span className="meta-tag">Buyer Intelligence</span>
          <h2 className="text-2xl font-black tracking-tight mt-1 leading-tight">Verified Buyers</h2>
          <p className="text-[10px] text-muted-foreground font-serif italic mt-2">
            A list of active investors looking for their next deal.
          </p>
        </div>
        
        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-0">
            {loading ? (
              <div className="py-12 text-center font-serif italic opacity-50">Finding buyers...</div>
            ) : buyers.length === 0 ? (
              <div className="py-12 text-center space-y-4">
                <Users className="w-8 h-8 mx-auto text-muted-foreground opacity-20" />
                <p className="text-[10px] font-serif italic text-muted-foreground">No buyers in your network yet.</p>
              </div>
            ) : buyers.map((buyer: any) => (
              <div key={buyer.id} className="py-6 border-b border-border group cursor-pointer hover:bg-secondary/30 transition-colors">
                <span className="block font-bold text-sm group-hover:text-accent transition-colors">{buyer.name}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Budget: ${(buyer.budget || 0).toLocaleString()} • {buyer.strategy}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 bg-secondary border border-border">
                    Verified Funds
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono font-bold">{buyer.intentScore}% Intent</span>
                    <Zap size={10} className="text-accent fill-accent" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>

      {/* Col 2: Matching Engine */}
      <section className="bg-white p-12 flex flex-col items-center justify-center border-r border-border relative">
        <div className="text-center mb-12">
          <span className="score-large block">{latestMatch?.score || '00'}</span>
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground mt-4 block">Match Success Probability</span>
        </div>

        <div className="w-full max-w-lg border border-foreground p-8 relative bg-background">
          <div className="absolute -top-2.5 left-6 bg-background px-2 font-mono text-[9px] tracking-widest uppercase font-bold">
            AI_MATCH_SUMMARY
          </div>
          <div className="space-y-4 font-serif text-sm italic">
            {latestMatch ? (
              <>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Property:</span>
                  <span className="font-bold not-italic">{latestMatch.dealTitle}</span>
                </div>
                <div className="justify-between border-b border-border pb-2 flex">
                  <span className="text-muted-foreground">Best Buyer:</span>
                  <span className="font-bold not-italic">{latestMatch.buyerName}</span>
                </div>
                <div className="pt-2">
                  <span className="text-muted-foreground block mb-2">Why they match:</span>
                  <p className="text-xs leading-relaxed opacity-80">"{latestMatch.reasons?.[0]}"</p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Run the matching engine to find the best buyers for your current deals.
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 w-full max-w-lg">
          <Button 
            className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-xs" 
            onClick={onRunMatching}
            disabled={isMatching}
          >
            {isMatching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Market...</> : 'Find Best Buyers for My Deals'}
          </Button>
          <p className="text-[9px] text-center mt-4 text-muted-foreground uppercase tracking-widest font-bold">
            Powered by PropOS Intelligence
          </p>
        </div>
      </section>

      {/* Col 3: Market Velocity */}
      <section className="p-10 flex flex-col">
        <div className="mb-10">
          <span className="meta-tag">Liquidity Distribution</span>
          <h2 className="text-2xl font-black tracking-tight mt-1 leading-tight">Market Velocity</h2>
          <p className="text-[10px] text-muted-foreground font-serif italic mt-2">
            Instantly alert your network when a match is found.
          </p>
        </div>

        <div className="space-y-8">
          {[
            { label: 'Auto-Alert Matched Buyers', desc: 'Send email to top matches' },
            { label: 'SMS Push (Hot Deals)', desc: 'Text high-intent buyers' },
            { label: 'CRM Export Sync', desc: 'Sync with your external tools' }
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-start pb-6 border-b border-dotted border-border">
              <div>
                <span className="text-xs font-bold block">{item.label}</span>
                <span className="text-[9px] text-muted-foreground italic">{item.desc}</span>
              </div>
              <div className="w-10 h-5 bg-foreground rounded-full relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-background rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <p className="text-[11px] leading-relaxed text-muted-foreground font-serif italic">
            Matches are calculated based on intent profiling, cash velocity, and geographic alignment within the acquisition layer.
          </p>
        </div>
      </section>
    </div>
  );
}

function PricingView() {
  return (
    <div className="p-12 space-y-24 max-w-6xl mx-auto">
      <div className="text-center space-y-4">
        <span className="meta-tag">Monetization Strategy</span>
        <h2 className="text-5xl font-black tracking-tighter">Don't charge for software.<br />Charge for liquidity.</h2>
        <p className="text-muted-foreground font-serif italic text-lg max-w-2xl mx-auto">
          Most property tech charges for access to tools. PropOS charges for moving deals faster and increasing portfolio ROI.
        </p>
      </div>

      {/* Pricing Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            tier: "Tier 1",
            title: "Property Manager",
            price: "$297",
            description: "For individual investors with 1-10 units.",
            features: [
              "Property management dashboard",
              "Tenant portal (rent collection)",
              "Basic AI phone agent (100m/mo)",
              "Document storage (5GB)",
              "Basic reporting (PNL, occupancy)",
              "5 properties max"
            ],
            cta: "Start Managing"
          },
          {
            tier: "Tier 2",
            title: "Deal Finder",
            price: "$497",
            description: "For wholesalers and active flippers.",
            features: [
              "Everything in Tier 1",
              "DealFlow acquisition engine",
              "Unlimited property scraping",
              "ARV + rehab analysis",
              "Market comps database",
              "Deal scoring algorithm",
              "50 property analyses/month"
            ],
            cta: "Find Deals",
            highlight: true
          },
          {
            tier: "Tier 3",
            title: "Liquidity Engine",
            price: "$997",
            description: "For professional investors and funds.",
            features: [
              "Everything in Tier 1-2",
              "BuyerFlow liquidity engine",
              "Unlimited buyer profiles",
              "Automated matching algorithm",
              "Deal distribution (email/SMS)",
              "Buyer intent scoring",
              "200 property analyses/month"
            ],
            cta: "Get Liquidity"
          }
        ].map((plan) => (
          <div key={plan.title} className={`p-8 border ${plan.highlight ? 'border-accent bg-secondary/30' : 'border-border'} flex flex-col relative`}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                Recommended
              </div>
            )}
            <span className="meta-tag text-xs mb-2">{plan.tier}</span>
            <h3 className="text-2xl font-black tracking-tight mb-1">{plan.title}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-black">{plan.price}</span>
              <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">/ month</span>
            </div>
            <p className="text-sm text-muted-foreground font-serif italic mb-8 h-10">{plan.description}</p>
            
            <div className="flex-1 space-y-4 mb-10">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 text-xs">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            
            <Button className={`w-full h-12 uppercase tracking-widest font-bold text-[10px] ${plan.highlight ? 'bg-accent text-white hover:bg-accent/90' : 'bg-foreground text-background hover:bg-foreground/90'}`}>
              {plan.cta}
            </Button>
          </div>
        ))}
      </div>

      {/* Enterprise Section */}
      <div className="border border-foreground p-12 flex flex-col md:flex-row justify-between items-center gap-12 relative">
        <div className="absolute -top-3 left-12 bg-background px-4 font-mono text-[10px] tracking-widest uppercase font-bold">
          ENTERPRISE_TIER
        </div>
        <div className="max-w-xl">
          <span className="meta-tag">Marketplace Operator</span>
          <h3 className="text-3xl font-black tracking-tight mt-2 mb-4">Regional Brokerages & Large Funds</h3>
          <p className="text-muted-foreground font-serif italic leading-relaxed">
            PropOS becomes YOUR liquidity engine. We'll customize everything for your workflow, including white-label dashboards, custom matching algorithms, and dedicated account management.
          </p>
        </div>
        <div className="text-center md:text-right shrink-0">
          <div className="text-sm uppercase tracking-widest font-bold text-muted-foreground mb-2">Starting at</div>
          <div className="text-5xl font-black tracking-tighter mb-6">$2,500<span className="text-lg">/mo</span></div>
          <Button variant="outline" className="h-14 px-10 border-foreground text-foreground hover:bg-foreground hover:text-background uppercase tracking-widest font-bold text-xs">
            Contact Sales
          </Button>
        </div>
      </div>

      {/* Add-ons and Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
        <div className="space-y-8">
          <div className="border-b border-border pb-4">
            <h4 className="text-xl font-black tracking-tight">Monetization Add-Ons</h4>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Revenue Multipliers</p>
          </div>
          <div className="space-y-6">
            {[
              { label: "Match Fee", value: "1% of deal value", desc: "When PropOS connects buyer ↔ seller (Capped at $5k)" },
              { label: "Lead Fee", value: "$50 - $500", desc: "Per qualified buyer lead based on intent score" },
              { label: "Success Fee", value: "2% of deal", desc: "Only when deal closes. No monthly subscription." }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-start border-b border-dotted border-border pb-4">
                <div>
                  <span className="font-bold text-sm block">{item.label}</span>
                  <span className="text-xs text-muted-foreground font-serif italic">{item.desc}</span>
                </div>
                <span className="font-mono font-bold text-accent">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="border-b border-border pb-4">
            <h4 className="text-xl font-black tracking-tight">Premium Features</h4>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">A La Carte Upgrades</p>
          </div>
          <div className="space-y-4">
            {[
              { label: "AI Phone Agent (Extra)", value: "$0.10/min" },
              { label: "Bulk SMS Campaigns", value: "$0.05/msg" },
              { label: "Priority Matching", value: "$199/mo" },
              { label: "Dedicated Manager", value: "$500/mo" },
              { label: "Custom Report Builder", value: "$99/mo" },
              { label: "Additional Team Seats", value: "$49/seat" }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center text-xs border-b border-border pb-2">
                <span className="font-medium">{item.label}</span>
                <span className="font-mono font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strategic Moves */}
      <div className="bg-foreground text-background p-16 space-y-12">
        <div className="text-center">
          <h4 className="text-3xl font-black tracking-tight">Strategic Pricing Moves</h4>
          <p className="text-white/50 font-serif italic mt-2">Hybrid models designed for 2025 real estate economics.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white font-bold">1</div>
            <h5 className="font-bold text-lg">Freemium Hook</h5>
            <p className="text-sm text-white/60 leading-relaxed">
              Get users in the door with 1 property and basic dashboard. Show them ONE match for free. They'll pay to see more.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white font-bold">2</div>
            <h5 className="font-bold text-lg">Hybrid Pricing</h5>
            <p className="text-sm text-white/60 leading-relaxed">
              Base SaaS fee ($497/mo) + Success Fee (0.5%). Users hate paying for software, but they LOVE paying for results.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white font-bold">3</div>
            <h5 className="font-bold text-lg">Volume Discounts</h5>
            <p className="text-sm text-white/60 leading-relaxed">
              Sliding scale success fees for high-volume wholesalers doing 50+ deals/year. Land and expand within funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend }: any) {
  return (
    <div className="border-l border-border pl-8 py-2 group">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground block mb-2">{title}</span>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-black tracking-tighter">{value}</span>
        <span className={`text-[10px] font-bold font-mono ${
          trend.startsWith('+') ? 'text-green-600' : trend.startsWith('-') ? 'text-red-600' : 'text-muted-foreground'
        }`}>
          {trend}
        </span>
      </div>
    </div>
  );
}
