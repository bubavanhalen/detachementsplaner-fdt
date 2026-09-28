/** The running application's own markup, captured at start for data-bearing offline exports. */
export let offlineTemplate = '';
export function setOfflineTemplate(value: string): void {
  offlineTemplate = value;
}
