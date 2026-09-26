import { notify, redoProject, undoProject, useHistory, useProject } from '../store';
import { modKey } from '../ui';
import { Icon } from './Icon';

export function runSafely(action: () => void): void {
  try {
    action();
  } catch (failure) {
    notify(failure instanceof Error ? failure.message : 'Aktion nicht möglich.', {
      tone: 'warning',
    });
  }
}

/** Session undo/redo shared by every page. Archive snapshots are read-only. */
export function HistoryButtons() {
  const history = useHistory();
  const archived = Boolean(useProject().archive);
  return (
    <div className="btn-group">
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label="Rückgängig"
        title={`Rückgängig (${modKey}+Z)`}
        disabled={archived || !history.canUndo}
        onClick={() => runSafely(undoProject)}
      >
        <Icon name="undo" size={17} />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label="Wiederholen"
        title={`Wiederholen (${modKey}+Shift+Z)`}
        disabled={archived || !history.canRedo}
        onClick={() => runSafely(redoProject)}
      >
        <Icon name="redo" size={17} />
      </button>
    </div>
  );
}
