# Incident: Navigate Only mode lacks HERE truck routing

**Status:** Mitigated (product gate) — full HERE in Navigate Only still not implemented  
**Severity:** P2 (safety / vehicle-profile gap)  
**Filed:** 2026-07-28  
**Mitigated:** 2026-08-07 (gate to full plan flow)  
**Related:** Start Navigation chooser + truck external-app warning (2026-07-28)

## Summary

Navigate Only mode (`fetchRouteBetween` / hero navigate “Get route”) always requests **Google `TravelMode.DRIVING`** with no vehicle profile. It never calls `POST /api/truck-routing` / HERE, even when the user’s answers select Semi Truck, Box Truck, Flatbed, or Tanker.

Full AI trip planning correctly uses HERE truck routing (height, weight, hazmat) via `shouldUseTruckRouting` in `fetchDirections` / `fetchItineraryRoute`.

## Expected

When a truck vehicle type is active in Navigate Only, routing should use the same HERE truck path as the full trip flow (or clearly refuse and steer the user to plan a truck trip).

## Actual (original)

Navigate Only always built a car-style Google driving route.

## Mitigation (2026-08-07)

When a truck vehicle is selected (`shouldUseTruckRouting` on session answers / route-setup / prefill), **Get route** and **Navigate Home** in Navigate Only **do not** call Google Directions. A gate dialog explains that truck routing requires the full planning flow and offers **Plan a truck trip**, which switches to plan mode with origin/destination preserved and the truck vehicle seeded.

Full HERE integration inside Navigate Only remains out of scope for this pass.

## Impact (residual)

Truck drivers who never select a truck vehicle in-session can still hit car Navigate Only. Drivers with a truck vehicle selected are redirected instead of getting a misleading car route.

## Proposed full fix (separate pass)

1. Branch `fetchRouteBetween` (or a shared helper) on `shouldUseTruckRouting(answers)`.
2. Call `fetchTruckRoute` with origin/destination (+ user truck specs); persist `hereRoute` like the full-trip path.
3. Fall back to Google only with an explicit toast that truck routing was unavailable.
4. Re-verify Start Navigation truck warning copy once Navigate Only can be truck-safe.
5. Remove or relax the product gate once HERE Navigate Only ships.

## Out of scope

The 2026-07-28 Start Navigation chooser + HERE TBT parsing work deliberately does **not** add HERE to Navigate Only; it only warns honestly. The 2026-08-07 gate refuses Navigate Only for trucks instead of wiring HERE there.
