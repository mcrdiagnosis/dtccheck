import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      const subscription = await new Stripe(process.env.STRIPE_SECRET_KEY!).subscriptions.retrieve(
        subscriptionId
      );
      const priceId = subscription.items.data[0]?.price.id;

      let plan = "free";
      if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) plan = "pro";
      if (priceId === process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID) plan = "premium";

      await supabase
        .from("subscriptions")
        .upsert({
          stripe_subscription_id: subscriptionId,
          user_id: session.metadata?.user_id,
          plan,
          status: "active",
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
        });

      await supabase
        .from("profiles")
        .update({ plan })
        .eq("stripe_customer_id", customerId);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
      await supabase
        .from("profiles")
        .update({ plan: "free" })
        .eq("stripe_customer_id", subscription.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
