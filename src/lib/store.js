/** Minimal observable state for the signed-in student + cross-view events. */

const listeners = new Map();

export const state = {
  session: null,
  profile: null,
  view: "overview",
};

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[ayaan-academia] listener for "${event}" failed`, error);
    }
  });
}

export function setProfile(profile) {
  state.profile = profile;
  emit("profile:changed", profile);
}

export function setSession(session) {
  state.session = session;
  emit("session:changed", session);
}

export function displayName() {
  const profile = state.profile;
  if (!profile) return "Student";
  return profile.display_name?.trim() || profile.username;
}

export function firstName() {
  const name = displayName();
  return name.split(/[\s._-]+/)[0];
}
