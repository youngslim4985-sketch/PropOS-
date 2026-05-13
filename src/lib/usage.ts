import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum ActionType {
  ATTOM_ENRICHMENT = 'ATTOM_ENRICHMENT',
  SKIP_TRACING = 'SKIP_TRACING',
  SMS_OUTREACH = 'SMS_OUTREACH',
  EMAIL_OUTREACH = 'EMAIL_OUTREACH',
  AI_DEAL_SCAN = 'AI_DEAL_SCAN',
}

export const ActionPrices: Record<ActionType, number> = {
  [ActionType.ATTOM_ENRICHMENT]: 0.02,
  [ActionType.SKIP_TRACING]: 0.01,
  [ActionType.SMS_OUTREACH]: 0.007,
  [ActionType.EMAIL_OUTREACH]: 0.005,
  [ActionType.AI_DEAL_SCAN]: 0.015,
};

export async function logUsage(workspaceId: string, userId: string, actionType: ActionType) {
  const cost = ActionPrices[actionType];
  try {
    await addDoc(collection(db, 'usageLogs'), {
      workspaceId,
      userId,
      actionType,
      cost,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}
