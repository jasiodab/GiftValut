let paused = false;

export function setMaintenanceMode(value: boolean) {
  paused = value;
}

export function isMaintenanceMode() {
  return paused;
}
