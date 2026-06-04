export interface FieldLocatorRunOptions {
  /** When true: skip turnover/annexure/experience/context rejection; show all candidates */
  debugMode?: boolean;
}

export function isFieldLocatorDebugMode(options?: FieldLocatorRunOptions): boolean {
  if (options?.debugMode === true) return true;
  if (options?.debugMode === false) return false;
  return process.env.FIELD_LOCATOR_DEBUG_MODE !== 'false';
}
