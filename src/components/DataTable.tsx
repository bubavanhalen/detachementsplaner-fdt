import {
  type ColumnDef,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { type ReactNode, useMemo } from 'react';
import { Icon } from './Icon';

const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns,
});
export interface DataColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  value?: (row: T) => string | number;
}

export function DataTable<T extends object>({
  data,
  columns,
  getRowId,
  emptyMessage = 'Keine passenden Personen.',
  selectedId,
  onRowClick,
  pageSize = 25,
}: {
  data: T[];
  columns: DataColumn<T>[];
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  selectedId?: string;
  /** Row click for convenience; every row action must also exist as a real control. */
  onRowClick?: (row: T) => void;
  pageSize?: number;
}) {
  const definitions = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        accessorFn: column.value ?? (() => ''),
        cell: (context) => column.cell(context.row.original),
        enableSorting: Boolean(column.value),
      })),
    [columns],
  );
  const table = useTable({
    features,
    columns: definitions,
    data,
    getRowId,
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });
  return (
    <div className="data-table">
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />{' '}
                        <span aria-hidden="true">
                          {header.column.getIsSorted() === 'asc'
                            ? '↑'
                            : header.column.getIsSorted() === 'desc'
                              ? '↓'
                              : '↕'}
                        </span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={selectedId && row.id === selectedId ? 'is-selected' : undefined}
                onClick={
                  onRowClick
                    ? (event) => {
                        if (
                          (event.target as HTMLElement).closest('button, a, input, label, select')
                        )
                          return;
                        onRowClick(row.original);
                      }
                    : undefined
                }
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data.length > pageSize && (
        <div className="pagination">
          <span>
            {data.length} Einträge · Seite {table.state.pagination.pageIndex + 1} von{' '}
            {table.getPageCount()}
          </span>
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <Icon name="chevronLeft" size={15} /> Zurück
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Weiter <Icon name="chevronRight" size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
