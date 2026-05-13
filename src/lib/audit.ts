import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function recordClientIntent(params: {
  workspaceId: string;
  type: string;
  proposedBy: string;
  data: any;
  idempotencyKey?: string;
}) {
  await addDoc(collection(db, 'intentEvents'), {
    ...params,
    timestamp: serverTimestamp(),
  });
}
