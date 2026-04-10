/**
 * Shared plugin type re-exports.
 * Centralises the plugin-type imports that AppContext (and other core files) need,
 * so core code does not have to import directly from individual plugin modules.
 * These are type-only exports — they are erased at compile time and have zero
 * runtime cost.
 */
export type { Contact } from '@/plugins/contacts/types/contacts';
export type { Estimate } from '@/plugins/estimates/types/estimate';
export type { Match } from '@/plugins/matches/types/match';
export type { Note, NoteShare } from '@/plugins/notes/types/notes';
export type { Slot } from '@/plugins/slots/types/slots';
export type { Task } from '@/plugins/tasks/types/tasks';
