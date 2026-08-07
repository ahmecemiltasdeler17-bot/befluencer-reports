import {
  mergeSelection,
  normalizeSelectedCreatorIds,
} from "@/features/creator-lists/calculations";
import { CREATOR_SELECTION_MAX } from "@/features/creator-lists/types";

export type CreatorSelectionState = {
  selectedIds: string[];
  limited: boolean;
};

export function createEmptySelection(): CreatorSelectionState {
  return { selectedIds: [], limited: false };
}

export function toggleCreatorSelection(
  state: CreatorSelectionState,
  creatorId: string,
  checked: boolean
): CreatorSelectionState {
  if (checked) {
    if (state.selectedIds.includes(creatorId)) {
      return { ...state, limited: false };
    }
    if (state.selectedIds.length >= CREATOR_SELECTION_MAX) {
      return { ...state, limited: true };
    }
    return {
      selectedIds: [...state.selectedIds, creatorId],
      limited: false,
    };
  }

  return {
    selectedIds: state.selectedIds.filter((id) => id !== creatorId),
    limited: false,
  };
}

export function selectVisibleCreators(
  state: CreatorSelectionState,
  visibleIds: string[],
  checked: boolean
): CreatorSelectionState {
  const merged = mergeSelection(state.selectedIds, visibleIds, checked);
  return { selectedIds: merged.ids, limited: merged.limited };
}

export function clearCreatorSelection(): CreatorSelectionState {
  return createEmptySelection();
}

export function areAllVisibleSelected(
  selectedIds: string[],
  visibleIds: string[]
): boolean {
  if (visibleIds.length === 0) {
    return false;
  }
  const selected = new Set(selectedIds);
  return visibleIds.every((id) => selected.has(id));
}

export function sanitizeSelectionIds(ids: string[]): string[] {
  return normalizeSelectedCreatorIds(ids);
}
