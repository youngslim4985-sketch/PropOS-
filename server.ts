import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import bodyParser from "body-parser";
import admin from "firebase-admin";

// Initialize Firebase Admin
// Note: In AI Studio, we can often rely on default credentials or env vars
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

let stripeClient: Stripe | null = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook needs raw body
  app.post("/api/webhooks/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return res.status(500).send("Webhook secret not configured");
    }

    let event;

    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.client_reference_id;
        const plan = session.metadata?.plan as string;

        if (workspaceId && plan) {
          await db.collection("workspaces").doc(workspaceId).update({
            plan: plan,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Workspace ${workspaceId} upgraded to ${plan}`);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        // Find workspace by stripeSubscriptionId
        const snapshot = await db.collection("workspaces")
          .where("stripeSubscriptionId", "==", subscription.id)
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          const workspaceDoc = snapshot.docs[0];
          await workspaceDoc.ref.update({
            plan: "free",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Workspace ${workspaceDoc.id} downgraded to free`);
        }
        break;
      }
    }

    res.json({ received: true });
  });

  // Regular API routes use JSON
  app.use(express.json());

  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const { workspaceId, plan, successUrl, cancelUrl } = req.body;
      
      if (!workspaceId || !plan) {
        return res.status(400).json({ error: "Missing workspaceId or plan" });
      }

      // Define prices (these would normally be in Stripe or a config)
      const prices: Record<string, string> = {
        pro: "price_PRO_ID_PLACEHOLDER", // Real price IDs would be needed
        enterprise: "price_ENT_ID_PLACEHOLDER"
      };

      const session = await getStripe().checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `PropOS ${plan.toUpperCase()} Plan`,
              },
              unit_amount: plan === "pro" ? 4900 : 19900, // $49 or $199
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: workspaceId,
        metadata: { plan }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/create-portal-session", async (req, res) => {
    try {
      const { customerId, returnUrl } = req.body;
      if (!customerId) return res.status(400).json({ error: "No customer ID found" });

      const portalSession = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  // Vite or Static Assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
