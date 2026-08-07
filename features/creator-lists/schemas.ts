import { z } from "zod";

import {
  CREATOR_LIST_STATUSES,
  CREATOR_SELECTION_MAX,
} from "@/features/creator-lists/types";

const nullableTrimmed = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .nullable()
    .optional();

export const createCreatorListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Liste adı gerekli.")
    .max(120, "Liste adı en fazla 120 karakter olabilir."),
  description: nullableTrimmed(1000),
  internalNotes: nullableTrimmed(5000),
  creatorIds: z
    .array(z.string().uuid())
    .min(1, "En az bir creator seçin.")
    .max(CREATOR_SELECTION_MAX),
  status: z.enum(CREATOR_LIST_STATUSES).optional(),
});

export const updateCreatorListSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: nullableTrimmed(1000),
  internalNotes: nullableTrimmed(5000),
  status: z.enum(CREATOR_LIST_STATUSES).optional(),
});

export const addCreatorsSchema = z.object({
  listId: z.string().uuid(),
  creatorIds: z
    .array(z.string().uuid())
    .min(1)
    .max(CREATOR_SELECTION_MAX),
});

export const itemNotesSchema = z.object({
  itemId: z.string().uuid(),
  publicNote: nullableTrimmed(500),
  internalNote: nullableTrimmed(2000),
});

export const reorderSchema = z.object({
  listId: z.string().uuid(),
  orderedItemIds: z.array(z.string().uuid()).min(1),
});
