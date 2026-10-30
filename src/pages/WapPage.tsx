import type { CSSProperties, ReactNode } from 'react';
import { I2Application } from '../components/wap/i2/I2Application';
import type { RouteKeys } from '../components/wap/i2/keyboard';
import type { WapCommand } from '../components/wap/i2/WapPalette';
import { excelImportEngine } from '../components/wap/import/engine';

/**
 * Data-free entry into the independent, local WAP product; only the grid scrolls (I2b-A A5). The Suite passes the
 * key delegation (`setRouteKeyDelegate`, UI-Richtlinie 18 S-3) and its header tools; the route draws its own header
 * instead of the Suite top bar (S-2).
 */
export default function WapPage({
  routeKeys,
  routeCommands,
  headerTools,
}: {
  readonly routeKeys?: (delegate: RouteKeys | null) => void;
  /** Befehle der Route für die Suite-Palette (Ctrl+K, Gruppe «WAP-Planer»; H-UI2, UX-H-08). */
  readonly routeCommands?: (source: (() => readonly WapCommand[]) | null) => void;
  readonly headerTools?: ReactNode;
} = {}) {
  return (
    <div style={{ '--wap-i2-height': '100dvh' } as CSSProperties}>
      <I2Application
        importEngine={excelImportEngine}
        {...(routeKeys === undefined ? {} : { routeKeys })}
        {...(routeCommands === undefined ? {} : { routeCommands })}
        {...(headerTools === undefined ? {} : { headerTools })}
      />
    </div>
  );
}
