import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Users, DollarSign, Wrench, ArrowRight } from 'lucide-react';
import { collection, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useRealtimeCollection } from '@/src/lib/hooks';
import { useTenant } from '@/src/lib/TenantContext';
import { toast } from 'sonner';

export function ManagePillar() {
  const { activeWorkspace } = useTenant();
  const { data: properties, loading } = useRealtimeCollection('properties', activeWorkspace?.id);

  const stats = useMemo(() => {
    const totalRent = properties.reduce((acc, p) => acc + (p.monthly_rent || 0), 0);
    const occupancy = properties.length > 0 
      ? (properties.reduce((acc, p) => acc + (p.occupied || 0), 0) / properties.reduce((acc, p) => acc + (p.units || 1), 0)) * 100
      : 0;
    const maintenance = properties.filter(p => p.status === 'maintenance').length;
    return { totalRent, occupancy, maintenance };
  }, [properties]);

  const addProperty = () => {
    if (!activeWorkspace) return;

    // Enforce Plan Limits
    if (activeWorkspace.plan === 'free' && properties.length >= 3) {
      toast.error("Free tier limit reached (3 properties). Upgrade to Pro for a larger portfolio.", {
        action: {
          label: 'Upgrade',
          onClick: () => window.dispatchEvent(new CustomEvent('nav-billing'))
        }
      });
      return;
    }

    addDoc(collection(db, 'properties'), {
      workspaceId: activeWorkspace.id,
      address: `${Math.floor(Math.random() * 9000) + 1000} Sunset Blvd, LA`,
      units: 4,
      occupied: 3,
      monthly_rent: 4200,
      status: 'active',
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Properties" value={properties.length} icon={Building2} />
        <StatCard title="Occupancy Rate" value={`${stats.occupancy.toFixed(1)}%`} icon={Users} color="text-neon-cyan" />
        <StatCard title="Monthly Rent" value={`$${stats.totalRent.toLocaleString()}`} icon={DollarSign} color="text-gold" />
        <StatCard title="Open Maintenance" value={stats.maintenance} icon={Wrench} color="text-yellow-500" />
      </div>

      <div className="terminal-card">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="font-display font-bold text-lg uppercase tracking-tight">Portfolio Oversight</h3>
          <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-widest" onClick={addProperty}>
            <Plus size={14} className="mr-2" /> Add Property
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="p-4 meta-tag">Address</th>
                <th className="p-4 meta-tag">Units</th>
                <th className="p-4 meta-tag">Occupancy</th>
                <th className="p-4 meta-tag">Monthly Rent</th>
                <th className="p-4 meta-tag">Status</th>
                <th className="p-4 meta-tag text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center font-mono text-xs text-muted">Awaiting Data...</td></tr>
              ) : properties.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center font-mono text-xs text-muted">No properties in portfolio.</td></tr>
              ) : properties.map((prop) => (
                <tr key={prop.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 font-bold text-sm">{prop.address}</td>
                  <td className="p-4 font-mono text-xs">{prop.units} Units</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1 bg-border w-20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-neon-cyan transition-all" 
                          style={{ width: `${(prop.occupied / prop.units) * 100}%` }} 
                        />
                      </div>
                      <span className="font-mono text-[10px]">{prop.occupied}/{prop.units}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-gold">${(prop.monthly_rent || 0).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`status-dot status-dot-${prop.status}`} />
                      <span className="text-[10px] uppercase font-bold tracking-widest">{prop.status}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" className="text-muted hover:text-accent" onClick={() => deleteDoc(doc(db, 'properties', prop.id))}>
                      <ArrowRight size={14} />
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

function StatCard({ title, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <div className="terminal-card p-6 space-y-4">
      <div className="flex justify-between items-start">
        <span className="meta-tag">{title}</span>
        <Icon size={16} className="text-muted" />
      </div>
      <div className={`font-display text-3xl font-black tracking-tighter ${color}`}>{value}</div>
    </div>
  );
}
