import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, QueryConstraint } from 'firebase/firestore';
import { db } from './firebase';

export function useRealtimeCollection(collectionPath: string, workspaceId?: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Prevent global queries on scoped collections before a workspace is selected
    const scopedCollections = ['properties', 'deals', 'buyers', 'matches', 'usageLogs', 'intentEvents'];
    if (scopedCollections.includes(collectionPath) && !workspaceId) {
      setData([]);
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [];
    
    if (workspaceId) {
      constraints.push(where('workspaceId', '==', workspaceId));
    }
    
    // Some collections might not have createdAt, but for PropOS we assume they do or it fails gracefully
    try {
      constraints.push(orderBy('createdAt', 'desc'));
    } catch (e) {
      // Ignore order if createdAt doesn't exist
    }

    const q = query(collection(db, collectionPath), ...constraints);
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Error fetching ${collectionPath}:`, err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionPath, workspaceId]);

  return { data, loading, error };
}
