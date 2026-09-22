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
}: {
  data: T[];
  columns: DataColumn<T>[];
  getRowId?: (row: T) => string;
  emptyMessage?: string;
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
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
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
              <tr key={row.id}>
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
      {data.length > 25 && (
        <div className="pagination">
          <span>
            {data.length} Personen · Seite {table.state.pagination.pageIndex + 1} von{' '}
            {table.getPageCount()}
          </span>
          <div className="button-row">
            <button
              type="button"
              className="button-secondary"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Zurück
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
