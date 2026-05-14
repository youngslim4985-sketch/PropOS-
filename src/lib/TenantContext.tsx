import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: string;
  stripeCustomerId?: string;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'admin' | 'agent' | 'viewer';
}

interface TenantContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeRole: string | null;
  setActiveWorkspace: (workspace: Workspace) => void;
  isLoading: boolean;
  createWorkspace: (name: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<WorkspaceMember[]>([]);
  const [activeWorkspace, setActiveWorkspaceRaw] = useState<Workspace | null>(() => {
    const saved = localStorage.getItem('activeWorkspaceId');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const setActiveWorkspace = (ws: Workspace) => {
    setActiveWorkspaceRaw(ws);
    localStorage.setItem('activeWorkspaceId', JSON.stringify(ws));
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setWorkspaces([]);
        setMemberships([]);
        setActiveWorkspaceRaw(null);
        localStorage.removeItem('activeWorkspaceId');
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    // 1. Listen to memberships
    const qMembers = query(collection(db, 'workspaceMembers'), where('userId', '==', user.uid));
    
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const ms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkspaceMember));
      setMemberships(ms);
      
      if (ms.length === 0) {
        setWorkspaces([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch associated workspaces
      const workspaceIds = ms.map(m => m.workspaceId);
      // Firestore 'in' query supports up to 10-30 items
      const qWorkspaces = query(collection(db, 'workspaces'), where('__name__', 'in', workspaceIds));
      
      const unsubscribeWs = onSnapshot(qWorkspaces, (wsSnapshot) => {
        const ws = wsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
        setWorkspaces(ws);
        
        // Restore active workspace if it still exists in the list
        if (activeWorkspace) {
          const stillExists = ws.find(w => w.id === activeWorkspace.id);
          if (stillExists) {
            setActiveWorkspaceRaw(stillExists);
          } else {
            setActiveWorkspaceRaw(ws[0] || null);
          }
        } else if (ws.length > 0) {
          setActiveWorkspace(ws[0]);
        }
        
        setIsLoading(false);
      });

      return () => unsubscribeWs();
    }, (err) => {
      console.error("Error fetching memberships:", err);
      setIsLoading(false);
    });

    return () => unsubscribeMembers();
  }, [user]);

  const activeRole = useMemo(() => {
    if (!activeWorkspace || !memberships.length) return null;
    return memberships.find(m => m.workspaceId === activeWorkspace.id)?.role || null;
  }, [activeWorkspace, memberships]);

  const createWorkspace = async (name: string) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'workspaces'), {
        name,
        ownerId: user.uid,
        plan: 'free',
        createdAt: serverTimestamp()
      });
      // Link user in workspaceMembers with deterministic ID for security rules
      const memberId = `${user.uid}_${docRef.id}`;
      await setDoc(doc(db, 'workspaceMembers', memberId), {
        userId: user.uid,
        workspaceId: docRef.id,
        role: 'admin',
        joinedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating workspace:", error);
    }
  };

  return (
    <TenantContext.Provider value={{ 
      workspaces, 
      activeWorkspace, 
      activeRole,
      setActiveWorkspace, 
      isLoading, 
      createWorkspace 
    }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
