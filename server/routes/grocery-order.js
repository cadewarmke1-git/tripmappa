/**
 * POST /api/grocery/order — Instacart Connect Fulfillment delivery order (stubbed).
 * Payload shape matches Instacart Create delivery order so live API keys can drop in later.
 * @see https://docs.instacart.com/connect/api/fulfillment/delivery_orders/create_delivery_order/
 */
import crypto from "crypto";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { getOrCreateProfile } from "../lib/tripCredits.js";
import { canUseGroceryDelivery } from "../lib/tiers.js";

function parseScheduledTime(value) {
  if (!value) return new Date(Date.now() + 60 * 60 * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : d;
}

function buildInstacartDeliveryPayload({
  orderId,
  tripId,
  items,
  address,
  scheduledTime,
  fulfillmentMode,
  hotelName,
}) {
  const scheduled = parseScheduledTime(scheduledTime);
  const locationCode = process.env.INSTACART_LOCATION_CODE || "stub-location-code";

  return {
    order_id: orderId,
    location_code: locationCode,
    address: {
      address_line_1: address?.address_line_1 || address?.line1 || "",
      address_line_2: address?.address_line_2 || address?.line2 || "",
      postal_code: address?.postal_code || address?.postal || "",
      city: address?.city || "",
      state: address?.state || "",
      country: address?.country || "US",
    },
    items: (items || []).map((name, index) => ({
      item: {
        upc: `STUB-UPC-${index + 1}`,
      },
      count: 1,
      special_instructions: String(name),
    })),
    user: {
      id: tripId || "anonymous-trip",
      first_name: "Trip",
      last_name: "Traveler",
      phone_number: process.env.INSTACART_STUB_PHONE || "+15555550100",
    },
    special_instructions: [
      hotelName ? `Deliver to hotel: ${hotelName}` : null,
      `Scheduled for ${scheduled.toISOString()}`,
      fulfillmentMode === "pickup" ? "Customer switched to store pickup." : null,
    ].filter(Boolean).join(" "),
    fulfillment_type: fulfillmentMode === "pickup" ? "pickup" : "delivery",
    requested_delivery_time: scheduled.toISOString(),
  };
}

function buildMockConfirmation({
  orderId,
  address,
  scheduledTime,
  fulfillmentMode,
  instacartPayload,
}) {
  const scheduled = parseScheduledTime(scheduledTime);
  const windowStart = new Date(scheduled);
  const windowEnd = new Date(scheduled);
  if (fulfillmentMode === "pickup") {
    windowEnd.setMinutes(windowEnd.getMinutes() + 45);
  } else {
    windowStart.setMinutes(windowStart.getMinutes() - 15);
    windowEnd.setMinutes(windowEnd.getMinutes() + 30);
  }

  const displayAddress = [
    address?.address_line_1,
    address?.address_line_2,
    [address?.city, address?.state, address?.postal_code].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  return {
    orderId,
    storeName: fulfillmentMode === "pickup" ? "Fresh Market Pickup (Stub)" : "Fresh Market (Stub)",
    deliveryAddress: displayAddress,
    scheduledTime: scheduled.toISOString(),
    estimatedDeliveryWindow: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    },
    fulfillmentMode: fulfillmentMode === "pickup" ? "pickup" : "delivery",
    instacartRequest: instacartPayload,
    stub: true,
  };
}

/** POST /api/grocery/order */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Sign in required for grocery delivery" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const profile = await getOrCreateProfile(admin, user.id);
  if (!canUseGroceryDelivery(profile.tier)) {
    return res.status(403).json({
      error: "Grocery delivery requires a Traveler plan",
      requiredTier: "traveler",
    });
  }

  const {
    items = [],
    address = {},
    scheduledTime = null,
    tripId = null,
    fulfillmentMode = "delivery",
    hotelName = null,
  } = req.body || {};

  const cleanedItems = (items || [])
    .map(item => String(item || "").trim())
    .filter(Boolean);

  if (!cleanedItems.length) {
    return res.status(400).json({ error: "At least one grocery item is required" });
  }

  if (!address?.address_line_1 && !address?.line1 && !address?.city) {
    return res.status(400).json({ error: "Delivery address is required" });
  }

  const orderId = `IC-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const instacartPayload = buildInstacartDeliveryPayload({
    orderId,
    tripId,
    items: cleanedItems,
    address,
    scheduledTime,
    fulfillmentMode,
    hotelName,
  });

  const confirmation = buildMockConfirmation({
    orderId,
    address: instacartPayload.address,
    scheduledTime,
    fulfillmentMode,
    instacartPayload,
  });

  return res.status(200).json(confirmation);
}
