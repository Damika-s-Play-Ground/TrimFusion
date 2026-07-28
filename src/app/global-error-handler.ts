import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Last-resort handler for errors that escape component logic. Logs with
 * enough context to correlate with user "copy diagnostics" reports.
 * (Everything is local — nothing is sent anywhere.)
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[TrimFusion] Unhandled error', error, {
      url: typeof location !== 'undefined' ? location.href : '',
      time: new Date().toISOString(),
    });
  }
}
