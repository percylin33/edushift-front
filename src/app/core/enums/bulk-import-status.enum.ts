/**
 * Lifecycle of a bulk-import job. Mirrors the backend
 * {@code BulkImportStatus} enum verbatim.
 *
 * <pre>
 *   Pending -- worker enqueued -->  Processing -- finished --> Completed
 *      \-- aborted ---------> Failed              \-- aborted -> Failed
 * </pre>
 *
 * <p>{@code Completed} can still carry per-row failures inside the
 * job's {@code errors} array; what makes it "completed" is that the
 * parser walked every row in the spreadsheet, not that every row was
 * persisted successfully. {@code Failed} signals an aborting failure
 * the worker couldn't recover from (invalid file format, IO error,
 * transient DB outage), surfaced via {@code failReason}.
 */
export enum BulkImportStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

/** Convenience predicate matching the backend {@code isTerminal()} method. */
export function isTerminalBulkImportStatus(status: BulkImportStatus): boolean {
  return status === BulkImportStatus.Completed || status === BulkImportStatus.Failed;
}
