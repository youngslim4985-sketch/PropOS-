import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  TrendingUp, 
  Zap,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Plus,
  CreditCard,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { auth, db } from '@/src/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useTenant } from '@/src/lib/TenantContext';

// --- Lazy Components ---
import { ManagePillar } from '@/src/components/ManagePillar';
import { AcquirePillar } from '@/src/components/AcquirePillar';
import { SellPillar } from '@/src/components/SellPillar';
import { BillingDashboard } from '@/src/components/BillingDashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activePillar, setActivePillar] = useState<'manage' | 'acquire' | 'sell' | 'billing'>('manage');
  const [showWorkspaceCreator, setShowWorkspaceCreator] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const { workspaces, activeWorkspace, setActiveWorkspace, isLoading: isTenancyLoading, createWorkspace } = useTenant();
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'workspaceInvites'), where('email', '==', user.email), where('status', '==', 'pending'));
    return onSnapshot(q, (sn) => {
      setPendingInvites(sn.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const handleAcceptInvite = async (invite: any) => {
    try {
      const memberId = `${user!.uid}_${invite.workspaceId}`;
      await setDoc(doc(db, 'workspaceMembers', memberId), {
        userId: user!.uid,
        workspaceId: invite.workspaceId,
        role: invite.role,
        joinedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'workspaceInvites', invite.id), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success("Joined workspace successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await setDoc(doc(db, 'workspaceInvites', inviteId), {
        status: 'declined',
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.info("Invite declined");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleNavBilling = () => setActivePillar('billing');
    window.addEventListener('nav-billing', handleNavBilling);
    return () => window.removeEventListener('nav-billing', handleNavBilling);
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Welcome to PropOS SaaS");
    } catch (error) {
      toast.error("Failed to sign in.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info("Session terminated");
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName) return;
    await createWorkspace(newWorkspaceName);
    setNewWorkspaceName('');
    setShowWorkspaceCreator(false);
    toast.success(`Workspace "${newWorkspaceName}" created`);
  };

  if (isAuthLoading || (user && isTenancyLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Toaster position="top-right" richColors />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-8 text-center"
        >
          <div className="space-y-4">
            <h1 className="font-display text-7xl font-black tracking-tighter text-gold">PropOS</h1>
            <p className="text-muted font-mono uppercase tracking-[0.2em] text-xs">Proprietary Real Estate SaaS v4</p>
          </div>

          <div className="terminal-card p-10 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-accent/20" />
            <div className="space-y-2">
              <ShieldCheck className="w-12 h-12 mx-auto text-accent" />
              <h2 className="text-xl font-bold uppercase tracking-tight">SaaS Multi-Tenant Access</h2>
              <p className="meta-tag">Identity Graph Integration Required</p>
            </div>
            
            <Button 
              onClick={handleLogin}
              className="w-full h-14 bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-3"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Sign in with Identity Provider
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Handle Workspace Selection or Creation if none exist
  if (user && workspaces.length === 0 && !isTenancyLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Initialize Your First Workspace</h2>
          <p className="text-muted text-sm font-mono uppercase tracking-widest">Setup tenant container to begin</p>
        </div>
        <form onSubmit={handleCreateWorkspace} className="max-w-md w-full terminal-card p-8 space-y-4">
          <label className="meta-tag">Workspace Name</label>
          <Input 
            value={newWorkspaceName} 
            onChange={(e) => setNewWorkspaceName(e.target.value)} 
            placeholder="e.g., Summit Estates Group" 
            className="bg-white/5 border-border"
          />
          <Button type="submit" className="w-full bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-xs">
            Create Workspace
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      <Toaster position="top-right" richColors />
      
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r border-border flex flex-col bg-card z-50">
        <div className="p-6 border-b border-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded flex items-center justify-center text-background font-black text-xl shadow-[0_0_15px_rgba(200,169,110,0.3)]">P</div>
            <span className="font-display font-black text-2xl tracking-tighter hidden lg:block uppercase">PropOS</span>
          </div>
          
          {/* Workspace Switcher */}
          <div className="hidden lg:block relative group">
            <Button variant="outline" className="w-full justify-between h-10 border-border bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest">
              <span className="truncate">{activeWorkspace?.name || 'Loading...'}</span>
              <ChevronDown size={14} className="text-muted" />
            </Button>
            
            <div className="absolute top-full left-0 w-full mt-1 bg-[#11141c] border border-border rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                {workspaces.map(ws => (
                  <button 
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws)}
                    className={`w-full text-left p-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors ${activeWorkspace?.id === ws.id ? 'text-accent bg-accent/5' : 'text-muted'}`}
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
              <button 
                 onClick={() => setShowWorkspaceCreator(true)}
                 className="w-full text-left p-3 text-[10px] font-bold uppercase tracking-widest border-t border-border text-neon-cyan hover:bg-neon-cyan/5 flex items-center gap-2"
              >
                <Plus size={12} /> New Workspace
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'manage', label: 'Operations', icon: LayoutDashboard },
            { id: 'acquire', label: 'Acquisiton', icon: TrendingUp },
            { id: 'sell', label: 'Liquidity', icon: Zap },
            { id: 'billing', label: 'Revenue/Billing', icon: CreditCard },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePillar(item.id as any)}
              className={`w-full flex items-center gap-4 p-3 rounded transition-all group ${
                activePillar === item.id 
                  ? 'bg-accent/15 text-accent border border-accent/30 shadow-[inset_0_0_10px_rgba(200,169,110,0.1)]' 
                  : 'text-muted hover:text-foreground hover:bg-white/5'
              }`}
            >
              <item.icon size={20} className={activePillar === item.id ? 'text-accent' : 'text-muted group-hover:text-foreground'} />
              <span className="font-bold text-[11px] uppercase tracking-[0.15em] hidden lg:block">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-4 bg-black/20">
          <div className="flex items-center gap-3 p-2">
            <div className="w-9 h-9 rounded bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold shadow-inner">
              {user.displayName?.charAt(0)}
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p className="text-[11px] font-bold uppercase tracking-tight truncate">{user.displayName}</p>
              <Badge variant="outline" className="text-[8px] py-0 px-1 border-accent/20 text-accent uppercase font-mono">
                {activeWorkspace?.plan} Account
              </Badge>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-4 text-muted hover:text-red-500 hover:bg-red-500/10 h-10 px-3" onClick={handleLogout}>
            <LogOut size={16} />
            <span className="font-bold text-[10px] uppercase tracking-widest hidden lg:block">Terminate</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-transparent">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/60 backdrop-blur-xl z-40">
          <div className="flex items-center gap-4">
            <span className="meta-tag">Workspace:</span>
            <span className="text-[10px] font-mono text-neon-cyan uppercase tracking-widest font-bold">
              {activeWorkspace?.name}
            </span>
            <div className="h-3 w-px bg-border mx-2" />
            <div className="flex items-center gap-2">
              <div className="status-dot status-dot-active" />
              <span className="text-[10px] font-mono text-green-500 uppercase">Tenant Isolated</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <AnimatePresence>
              {pendingInvites.length > 0 && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="relative cursor-pointer group"
                >
                  <Bell size={18} className="text-accent animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] flex items-center justify-center font-bold">
                    {pendingInvites.length}
                  </span>
                  
                  <div className="absolute top-full right-0 mt-4 w-64 bg-card border border-border rounded-lg shadow-2xl p-4 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-[100]">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-border pb-2">Pending Invitations</p>
                    <div className="space-y-3">
                      {pendingInvites.map(invite => (
                        <div key={invite.id} className="space-y-2 p-2 bg-white/5 rounded border border-white/5">
                          <p className="text-[9px] font-mono uppercase truncate opacity-70">Workspace ID: {invite.workspaceId.slice(0,8)}...</p>
                          <p className="text-[10px] font-bold uppercase">Role: {invite.role}</p>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-[8px] flex-1 bg-accent text-background" onClick={() => handleAcceptInvite(invite)}>Accept</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[8px] flex-1 border border-border" onClick={() => handleDeclineInvite(invite.id)}>Decline</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-border">
              <span className="meta-tag text-[8px]">Network:</span>
              <span className="text-[10px] font-mono text-neon-cyan animate-pulse">0.8ms</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-[10px] font-mono text-muted uppercase tracking-tighter italic">PropOS SaaS Cluster v4.1</span>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePillar}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full"
            >
              {activePillar === 'manage' && <ManagePillar />}
              {activePillar === 'acquire' && <AcquirePillar />}
              {activePillar === 'sell' && <SellPillar />}
              {activePillar === 'billing' && <BillingDashboard />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* New Workspace Modal */}
      {showWorkspaceCreator && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="terminal-card w-full max-w-sm p-8 space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-display font-bold text-xl uppercase tracking-tighter">New Tenant Container</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowWorkspaceCreator(false)}>×</Button>
            </div>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <label className="meta-tag">Workspace Identity</label>
                <Input 
                  value={newWorkspaceName} 
                  onChange={(e) => setNewWorkspaceName(e.target.value)} 
                  placeholder="e.g., Gotham Real Estate" 
                  className="bg-white/5 border-border"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full bg-accent text-background hover:bg-accent/90 font-bold uppercase tracking-widest text-[10px] h-12">
                Initialize Workspace
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
