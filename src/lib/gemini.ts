import { auth } from './firebase';

export async function matchDealToBuyer(deal: any, buyer: any) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Authentication required for AI analysis");

  const response = await fetch("/api/ai/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ deal, buyer }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to analyze match");
  }

  return response.json();
}
