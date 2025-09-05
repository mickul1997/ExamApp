// Preload script
//
// The preload script runs in a context that has access to both the DOM
// (renderer world) and limited Node APIs (preload world).  It is an
// opportunity to expose safe, whitelisted APIs from the main process to the
// renderer without enabling full Node integration.  In this application we
// don't expose anything; context isolation is enabled and no Node modules
// are exported.

export {};