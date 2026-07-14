import { state } from '../state.js';
import { canvas } from '../canvas.js';

// =========================================================
// SELECT TOOL — helper stubs
// =========================================================
// Selection logic is tightly coupled to the canvas event routing in main.js.
// This module provides minimal exports that can be expanded in future tasks.

export function handleSelectClick(target) {
  // Selection-specific logic is handled inline in the canvas mouse:down handler in main.js.
  // Kept here as an extension point for future refactoring.
}

export function deleteSelected() {
  // Delete-key handler for selected objects is handled in main.js keydown handler.
  // Kept here as an extension point for future refactoring.
}
