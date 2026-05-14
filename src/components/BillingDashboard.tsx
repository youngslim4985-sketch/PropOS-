import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { useTenant } from '@/src/lib/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  Zap, 
  Activity, 
  Rocket, 
  ShieldCheck, 
  Loader2, 
  Users, 
  History, 
  Wallet,
  Mail,
  UserPlus,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth } from '@/src/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';

export function BillingDashboard() {
  const { activeWorkspace, activeRole } = useTenant();
  const { data: usageLogs, loading } = useRealtimeCollection('usageLogs', activeWorkspace?.id);
  const { data: intentEvents, loading: intentLoading } = useRealtimeCollection('intentEvents', activeWorkspace?.id);
  const { data: members, loading: membersLoading } = useRealtimeCollection('workspaceMembers', activeWorkspace?.id);
  const { data: invites, loading: invitesLoading } = useRealtimeCollection('workspaceInvites', activeWorkspace?.id);
  
  const [activeTab, setActiveTab] = useState<'billing' | 'audit' | 'team'>('billing');
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent' | 'viewer'>('agent');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session_id')) {
      toast.success('Subscription updated successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const totalSpent = useMemo(() => {
    return usageLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [usageLogs]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail) return;
    setIsInviting(true);
    try {
      await addDoc(collection(db, 'workspaceInvites'), {
        workspaceId: activeWorkspace.id,
        email: inviteEmail.toLowerCase(),
        role: inviteRole,
        status: 'pending',
        invitedBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'workspaceMembers', memberId));
      toast.info("Member removed");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

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
    if (activeRole !== 'admin') {
      toast.error("Only workspace admins can upgrade plans.");
      return;
    }
    
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
        if (response.status === 409) {
          toast.info("An upgrade session is already active.");
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      toast.error(error.message);
      upgradeKeyRef.current = null;
    } finally {
      setIsUpgrading(null);
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      <div className="flex items-center gap-4 border-b border-border pb-6">
        {[
          { id: 'billing', label: 'Billing & Usage', icon: Wallet },
          { id: 'team', label: 'Team & Access', icon: Users },
          { id: 'audit', label: 'Audit Log', icon: History }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-accent text-background' : 'hover:bg-white/5 text-muted'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'billing' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
      )}

      {activeTab === 'team' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="terminal-card p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="font-display font-bold text-lg uppercase tracking-tight flex items-center gap-2">
                  <UserPlus size={18} className="text-accent" />
                  Invite Collaborator
                </h3>
                <p className="text-xs text-muted font-mono uppercase">Add team members to this workspace</p>
              </div>
              
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <label className="meta-tag">Email Address</label>
                  <Input 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="bg-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="meta-tag">Role Appointment</label>
                  <select 
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-white/5 border border-border rounded-md px-3 py-2 text-xs font-mono uppercase text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="viewer">Viewer (Read Only)</option>
                    <option value="agent">Agent (Operations)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
                <Button 
                  type="submit" 
                  disabled={isInviting || activeRole !== 'admin'}
                  className="w-full bg-accent text-background font-bold uppercase tracking-widest text-[10px]"
                >
                  {isInviting ? <Loader2 size={12} className="animate-spin" /> : 'Dispatch Invitation'}
                </Button>
                {activeRole !== 'admin' && (
                  <p className="text-[9px] text-red-400 font-mono uppercase text-center italic">Admin privileges required</p>
                )}
              </form>
            </div>

            <div className="terminal-card">
              <div className="p-6 border-b border-border">
                <h3 className="font-display font-bold text-lg uppercase tracking-tight">Active Roster</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="p-4 meta-tag">Identity</th>
                      <th className="p-4 meta-tag">Role</th>
                      <th className="p-4 meta-tag">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {membersLoading ? (
                      <tr><td colSpan={3} className="p-8 text-center font-mono text-xs text-muted">Indexing members...</td></tr>
                    ) : members.map((member) => (
                      <tr key={member.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-[10px] text-muted">{member.userId}</td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-[8px] uppercase">{member.role}</Badge>
                        </td>
                        <td className="p-4">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={activeRole !== 'admin' || member.userId === auth.currentUser?.uid}
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-muted hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="terminal-card">
            <div className="p-6 border-b border-border">
              <h3 className="font-display font-bold text-lg uppercase tracking-tight">Pending Dispatch (Invites)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <th className="p-4 meta-tag">Recipient</th>
                    <th className="p-4 meta-tag">Role</th>
                    <th className="p-4 meta-tag">Status</th>
                    <th className="p-4 meta-tag">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitesLoading ? (
                    <tr><td colSpan={4} className="p-8 text-center font-mono text-xs text-muted">Fetching invites...</td></tr>
                  ) : invites.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center font-mono text-xs text-muted">No pending invites.</td></tr>
                  ) : invites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono text-[10px] text-accent uppercase">{invite.email}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-[8px] uppercase">{invite.role}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className="text-[8px] uppercase animate-pulse">{invite.status}</Badge>
                      </td>
                      <td className="p-4 font-mono text-[10px] text-muted">
                        {invite.expiresAt?.toDate ? invite.expiresAt.toDate().toLocaleDateString() : '7 days'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="terminal-card animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="font-display font-bold text-lg uppercase tracking-tight">Audit Trail & Intent Log</h3>
            <Badge variant="outline" className="text-[10px] opacity-50">TRACEABILITY LAYER</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5">
                  <th className="p-4 meta-tag">Event Type</th>
                  <th className="p-4 meta-tag">Origin</th>
                  <th className="p-4 meta-tag">Context</th>
                  <th className="p-4 meta-tag">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {intentLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center font-mono text-xs text-muted">Scanning ledger history...</td></tr>
                ) : intentEvents.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center font-mono text-xs text-muted">No state changes recorded.</td></tr>
                ) : intentEvents.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).map((event) => (
                  <tr key={event.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-accent">{event.type.replace(/_/g, ' ')}</span>
                        {event.idempotencyKey && (
                          <span className="text-[8px] font-mono text-muted uppercase">Key: {event.idempotencyKey.slice(0, 16)}...</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-muted uppercase">{event.proposedBy}</td>
                    <td className="p-4">
                      <div className="max-w-xs truncate font-mono text-[9px] text-muted bg-black/20 p-2 rounded border border-white/5">
                        {JSON.stringify(event.data)}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-muted">
                      {event.timestamp?.toDate ? event.timestamp.toDate().toLocaleString() : 'Just now'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
