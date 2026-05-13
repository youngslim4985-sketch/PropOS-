import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
}

interface TenantContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace) => void;
  isLoading: boolean;
  createWorkspace: (name: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setWorkspaces([]);
        setActiveWorkspace(null);
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    // In a real app, we'd check WorkspaceMembers, but for this demo, we'll check ownerId or members
    const q = query(collection(db, 'workspaces'), where('ownerId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ws = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
      setWorkspaces(ws);
      
      if (ws.length > 0 && !activeWorkspace) {
        setActiveWorkspace(ws[0]);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching workspaces:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
    <TenantContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, isLoading, createWorkspace }}>
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
