/**
 * `KartTrackIntent` — the input shape for `lapvisor track create`. Callers
 * describe gates by `(center, bearing_deg, width_m)` and lapvisor computes the
 * LineString endpoints to produce a complete `kart-track/v1` FeatureCollection.
 *
 * This keeps the gate-endpoint math (Haversine destination) inside lapvisor:
 * upstream tools like `kart track convert` only need to translate their
 * source's coordinate scaling and trap classification — no geo math required.
 */

import { z } from "zod";

const lonLatSchema = z
  .tuple([z.number(), z.number()])
  .describe("[longitude, latitude] in decimal degrees");

const intentFeatureSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["start_finish", "sector", "unknown"]),
  name: z.string(),
  order: z.number().int().nonnegative(),
  bearing_deg: z.number(),
  width_m: z.number().positive(),
  unidirectional: z.boolean(),
  center: lonLatSchema,
  raw_type: z.number().int().optional(),
});

export const kartTrackIntentSchema = z.object({
  name: z.string().min(1),
  source: z
    .object({
      format: z.string(),
      file: z.string(),
    })
    .optional(),
  /** Optional — derived from feature centers if absent. */
  center: lonLatSchema.optional(),
  features: z.array(intentFeatureSchema).min(1),
});

export type KartTrackIntent = z.infer<typeof kartTrackIntentSchema>;
export type KartTrackIntentFeature = z.infer<typeof intentFeatureSchema>;
