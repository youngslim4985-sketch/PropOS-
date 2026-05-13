import { useMemo, useState, useRef } from 'react';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { useTenant } from '@/src/lib/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DollarSign, Zap, Activity, Rocket, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function BillingDashboard() {
  const { activeWorkspace } = useTenant();
  const { data: usageLogs, loading } = useRealtimeCollection('usageLogs', activeWorkspace?.id);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session_id')) {
      toast.success('Subscription updated successfully!');
      window.history.replaceState({}, document.title, "/");
    }
  });

  const totalSpent = useMemo(() => {
    return usageLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [usageLogs]);

  const handleManageSubscription = async () => {
    if (!activeWorkspace?.stripeCustomerId) {
      toast.error("No active subscription found. Upgrade to manage billing.");
      return;
    }
    setIsRedirecting(true);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeWorkspace.stripeCustomerId,
          returnUrl: window.location.href,
        })
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (error: any) {
      toast.error("Failed to load billing portal");
    } finally {
      setIsRedirecting(false);
    }
  };

  const upgradeKeyRef = useRef<string | null>(null);

  const handleUpgrade = async (plan: 'pro' | 'enterprise') => {
    if (!activeWorkspace) return;
    
    // Ensure we have a stable key for this session's upgrade attempt
    if (!upgradeKeyRef.current) {
      upgradeKeyRef.current = `upg_${activeWorkspace.id}_${Math.random().toString(36).slice(2, 11)}`;
    }

    setIsUpgrading(plan);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          customerId: activeWorkspace.stripeCustomerId,
          plan,
          successUrl: window.location.href + '?session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: window.location.href,
          idempotencyKey: upgradeKeyRef.current
        })
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // If it's a conflict (409), it means it's already working, so we just wait or show a message
        if (response.status === 409) {
          toast.info("An upgrade session is already active.");
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      toast.error(error.message);
      // Reset key on actual failure so they can try fresh if they want
      upgradeKeyRef.current = null;
    } finally {
      setIsUpgrading(null);
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      {/* SaaS Plan Selector (Commercial Layer) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PlanCard 
          name="Free" 
          price="$0" 
          active={activeWorkspace?.plan === 'free'} 
          features={["3 Deal Scans/mo", "Basic Portfolio", "1 User"]}
        />
        <PlanCard 
          name="Pro" 
          price="$49" 
          active={activeWorkspace?.plan === 'pro'} 
          features={["Unlimited Scans", "Identity Graph", "API Access"]}
          onUpgrade={() => handleUpgrade('pro')}
          loading={isUpgrading === 'pro'}
          icon={Rocket}
        />
        <PlanCard 
          name="Enterprise" 
          price="$199" 
          active={activeWorkspace?.plan === 'enterprise'} 
          features={["Bulk Enrichment", "Dedicated Node", "SLA Support"]}
          onUpgrade={() => handleUpgrade('enterprise')}
          loading={isUpgrading === 'enterprise'}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="terminal-card p-6 space-y-4">
          <div className="flex justify-between items-start">
            <span className="meta-tag">Total Accrued (Current Month)</span>
            <DollarSign size={16} className="text-gold" />
          </div>
          <div className="font-display text-4xl font-black tracking-tighter text-gold">
            ${totalSpent.toFixed(3)}
          </div>
        </div>
        <div className="terminal-card p-6 space-y-4">
          <div className="flex justify-between items-start">
            <span className="meta-tag">Active Actions tracked</span>
            <Zap size={16} className="text-neon-cyan" />
          </div>
          <div className="font-display text-4xl font-black tracking-tighter text-neon-cyan">
            {usageLogs.length}
          </div>
        </div>
        <div className="terminal-card p-6 space-y-4">
          <div className="flex justify-between items-start">
            <span className="meta-tag">Billing Plan</span>
            <Activity size={16} className="text-muted" />
          </div>
          <div className="flex flex-col">
            <div className="font-display text-2xl font-black tracking-tighter uppercase flex items-center gap-2">
              {activeWorkspace?.plan || 'N/A'}
              {activeWorkspace?.plan !== 'free' && activeWorkspace?.subscriptionStatus && activeWorkspace?.subscriptionStatus !== 'active' && (
                <Badge variant="destructive" className="text-[8px] uppercase">{activeWorkspace.subscriptionStatus}</Badge>
              )}
            </div>
          </div>
          {activeWorkspace?.plan !== 'free' && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 text-[8px] border-accent/20 text-accent uppercase font-bold"
              onClick={handleManageSubscription}
              disabled={isRedirecting}
            >
              {isRedirecting ? <Loader2 size={10} className="animate-spin" /> : 'Manage Subscription'}
            </Button>
          )}
        </div>
      </div>

      <div className="terminal-card">
        <div className="p-6 border-b border-border">
          <h3 className="font-display font-bold text-lg uppercase tracking-tight">Usage Metering Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="p-4 meta-tag">Action</th>
                <th className="p-4 meta-tag">User ID</th>
                <th className="p-4 meta-tag">Cost</th>
                <th className="p-4 meta-tag">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center font-mono text-xs text-muted">Awaiting logs...</td></tr>
              ) : usageLogs.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center font-mono text-xs text-muted">No billable actions detected.</td></tr>
              ) : usageLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-xs uppercase tracking-widest">{log.actionType}</td>
                  <td className="p-4 font-mono text-[10px] text-muted">{log.userId.slice(0, 8)}...</td>
                  <td className="p-4 font-mono text-xs text-gold">${log.cost?.toFixed(3)}</td>
                  <td className="p-4 font-mono text-[10px] text-muted">
                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Just now'}
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

function PlanCard({ name, price, active, features, onUpgrade, loading, icon: Icon }: any) {
  return (
    <div className={`terminal-card p-6 flex flex-col justify-between relative ${active ? 'border-accent ring-1 ring-accent/20' : ''}`}>
      {active && (
        <Badge className="absolute top-4 right-4 bg-accent text-background font-black text-[8px] uppercase tracking-widest">
          Active Plan
        </Badge>
      )}
      <div className="space-y-6">
        <div className="space-y-2">
          {Icon && <Icon className={`${active ? 'text-accent' : 'text-muted'} mb-2`} size={24} />}
          <h4 className="font-display font-black text-2xl uppercase tracking-tight">{name}</h4>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-gold">{price}</span>
            <span className="text-[10px] text-muted font-mono uppercase">/ mo</span>
          </div>
        </div>

        <ul className="space-y-3">
          {features.map((f: string, i: number) => (
            <li key={i} className="text-[10px] text-muted font-bold uppercase tracking-widest flex items-center gap-2">
              <Zap size={10} className="text-accent" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <Button 
        variant={active ? "outline" : "default"} 
        disabled={active || loading}
        onClick={onUpgrade}
        className={`w-full mt-8 uppercase font-bold tracking-widest text-[10px] ${active ? 'border-accent text-accent' : 'bg-accent text-background hover:bg-accent/90'}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : active ? 'Current Tier' : `Upgrade to ${name}`}
      </Button>
    </div>
  );
}
