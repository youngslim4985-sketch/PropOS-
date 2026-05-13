import admin from "firebase-admin";

function getDb() {
  return admin.firestore();
}

export enum IdempotencyStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface IdempotencyConfig {
  key: string;
  workspaceId: string;
  expiresInMs?: number;
}

/**
 * Ensures a function is executed only once for a given key.
 * If the key already exists and is completed, returns the previous result.
 * If the key exists and is pending, throws a 'concurrency' error.
 */
export async function withIdempotency<T>(
  config: IdempotencyConfig,
  fn: () => Promise<T>
): Promise<T> {
  const { key, workspaceId, expiresInMs = 24 * 60 * 60 * 1000 } = config;
  const db = getDb();
  const docRef = db.collection("idempotencyRequests").doc(key);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);

    if (doc.exists) {
      const data = doc.data();
      if (data?.status === IdempotencyStatus.COMPLETED) {
        return data.response as T;
      }
      if (data?.status === IdempotencyStatus.PENDING) {
        throw new Error("OPERATION_IN_PROGRESS");
      }
      // If failed, we allow a retry by falling through
    }

    // Mark as pending
    transaction.set(docRef, {
      status: IdempotencyStatus.PENDING,
      workspaceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + expiresInMs),
    });

    try {
      const result = await fn();
      
      transaction.update(docRef, {
        status: IdempotencyStatus.COMPLETED,
        response: result || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return result;
    } catch (error: any) {
      transaction.update(docRef, {
        status: IdempotencyStatus.FAILED,
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw error;
    }
  });
}

/**
 * Records an intent before execution.
 */
export async function recordIntent(params: {
  workspaceId: string;
  type: string;
  proposedBy: string;
  data: any;
  idempotencyKey?: string;
}) {
  const db = getDb();
  await db.collection("intentEvents").add({
    ...params,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}
