/**
 * PrintQueue — background print job queue with retry logic.
 *
 * Features:
 *   - Job queuing with priority
 *   - Automatic retry on failure (configurable max retries)
 *   - Sequential processing (one print job at a time)
 *   - Status tracking (queued → processing → success/failed)
 *   - Auto-flush on startup
 */

const db = require("../config/db");
const { buildPrintNo } = require("../models/PrintLogModel");
const PrintConfig = require("../PrintConfig");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const isTestEnv = () => process.env.NODE_ENV === "test";

class PrintQueue {
  constructor() {
    this.processing = false;
    this.queueInterval = null;
    this.logger = isTestEnv() ? () => {} : console.log.bind(console, "[PrintQueue]");
  }

  /**
   * Add a print job to the queue.
   * @param {string} printType - one of the PRINT_TYPES keys
   * @param {object} payload - job data passed to the print service
   * @param {number} priority - higher = processed first
   * @param {number} maxRetries - max retry attempts on failure
   * @returns {Promise<string>} jobId
   */
  async enqueue(printType, payload = {}, priority = 0, maxRetries = 3) {
    const printerKey = PrintConfig.resolvePrinterWithOverride(printType);
    const printer = PrintConfig.getPrinter(printerKey);
    const jobId = `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await runQuery(
      `INSERT INTO print_queue (job_id, print_type, payload, printer_name, priority, max_retries, status)
       VALUES (?, ?, ?, ?, ?, ?, 'queued')`,
      [jobId, printType, JSON.stringify(payload), printer.name, priority, maxRetries],
    );

    this.logger(`Job queued: ${jobId} type=${printType} printer=${printer.name}`);
    return jobId;
  }

  /**
   * Start the background processor that polls the queue.
   */
  start() {
    if (this.queueInterval) return;

    this.logger("Print queue processor started");

    // Flush existing queued jobs on startup
    this.flushPendingJobs();

    // Poll every 2 seconds
    this.queueInterval = setInterval(() => {
      this.processNext().catch((err) => {
        this.logger("Queue processing error:", err.message);
      });
    }, 2000);
  }

  /**
   * Stop the background processor.
   */
  stop() {
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
      this.logger("Print queue processor stopped");
    }
  }

  /**
   * Process the next queued job (highest priority first).
   */
  async processNext() {
    if (this.processing) return;
    this.processing = true;

    try {
      const jobRows = await runQuery(
        `SELECT * FROM print_queue
         WHERE status = 'queued'
         ORDER BY priority DESC, created_at ASC
         LIMIT 1`,
      );

      if (!jobRows || !jobRows.length) {
        this.processing = false;
        return;
      }

      const job = jobRows[0];
      await this.processJob(job);
    } catch (err) {
      this.logger("Failed to fetch next job:", err.message);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single job.
   */
  async processJob(job) {
    const startTime = Date.now();
    this.logger(`Processing job: ${job.job_id} type=${job.print_type}`);

    // Mark as processing
    await runQuery(
      `UPDATE print_queue SET status = 'processing', processed_at = NOW() WHERE id = ?`,
      [job.id],
    );

    try {
      const result = await this.executePrintJob(job);

      // Success
      await runQuery(`UPDATE print_queue SET status = 'completed' WHERE id = ?`, [job.id]);

      const printNo = buildPrintNo();
      await runQuery(
        `INSERT INTO print_logs
          (print_no, invoice_no, kot_no, print_type, printer_name, print_count, printed_by, printed_at, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`,
        [
          printNo,
          result.invoiceNo || null,
          result.kotNo || null,
          job.print_type,
          job.printer_name,
          result.printCount || 1,
          result.printedBy || null,
          new Date(),
          JSON.stringify({
            jobId: job.job_id,
            durationMs: Date.now() - startTime,
            payload: job.payload || {},
          }),
        ],
      );

      this.logger(`Job completed: ${job.job_id} in ${Date.now() - startTime}ms`);
    } catch (err) {
      this.logger(`Job failed: ${job.job_id} error=${err.message}`);

      const newRetryCount = (job.retry_count || 0) + 1;

      if (newRetryCount >= (job.max_retries || 3)) {
        // Final failure
        await runQuery(
          `UPDATE print_queue SET status = 'failed', retry_count = ?, error_message = ? WHERE id = ?`,
          [newRetryCount, err.message, job.id],
        );

        // Log failure
        await runQuery(
          `INSERT INTO print_logs
            (print_no, invoice_no, kot_no, print_type, printer_name, print_count, printed_by, printed_at, status, error_message, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
          [
            buildPrintNo(),
            null,
            null,
            job.print_type,
            job.printer_name,
            1,
            null,
            new Date(),
            err.message,
            JSON.stringify({ jobId: job.job_id, retryCount: newRetryCount }),
          ],
        );
      } else {
        // Retry — re-queue
        await runQuery(
          `UPDATE print_queue SET status = 'queued', retry_count = ? WHERE id = ?`,
          [newRetryCount, job.id],
        );
        this.logger(`Job re-queued for retry: ${job.job_id} attempt=${newRetryCount}/${job.max_retries}`);
      }
    }
  }

  /**
   * Execute the actual print job by delegating to the appropriate service.
   */
  async executePrintJob(job) {
    const { print_type, payload } = job;

    let payloadObj = {};
    if (typeof payload === "string") {
      try {
        payloadObj = JSON.parse(payload);
      } catch {
        payloadObj = { raw: payload };
      }
    } else if (typeof payload === "object") {
      payloadObj = payload;
    }

    const printerKey = PrintConfig.resolvePrinterWithOverride(print_type);
    const printer = PrintConfig.getPrinter(printerKey);

    // Dispatch to the right print service
    switch (print_type) {
      case "kot":
      case "room_service_bill":
      case "kot_customer_copy": {
        const { KitchenPrintService } = require("./KitchenPrintService");
        return KitchenPrintService.printKOT(payloadObj, printerKey);
      }

      case "restaurant_pos_bill": {
        const { RestaurantPrintService } = require("./RestaurantPrintService");
        return RestaurantPrintService.printBill(payloadObj, printerKey);
      }

      case "cash_receipt":
      case "refund_receipt":
      case "payment_receipt":
      case "advance_receipt": {
        const { ThermalPrintService } = require("./ThermalPrintService");
        return ThermalPrintService.printReceipt(print_type, payloadObj, printerKey);
      }

      case "gst_invoice":
      case "final_invoice":
      case "restaurant_bill_a4":
      case "room_service_bill_a4":
      case "credit_settlement":
      case "reservation_confirmation":
      case "guest_registration":
      case "checkout_bill":
      case "folio_statement": {
        const { InvoicePrintService } = require("./InvoicePrintService");
        return InvoicePrintService.printInvoice(print_type, payloadObj, printerKey);
      }

      default: {
        // Fallback: try thermal for receipt types, A4 for everything else
        const isThermal =
          print_type.includes("receipt") || print_type.includes("bill") || print_type.includes("kot");

        if (isThermal) {
          const { ThermalPrintService } = require("./ThermalPrintService");
          return ThermalPrintService.printReceipt(print_type, payloadObj, printerKey);
        } else {
          const { InvoicePrintService } = require("./InvoicePrintService");
          return InvoicePrintService.printInvoice(print_type, payloadObj, printerKey);
        }
      }
    }
  }

  /**
   * Flush existing pending jobs (called on startup).
   */
  async flushPendingJobs() {
    try {
      const rows = await runQuery(
        `SELECT COUNT(*) AS cnt FROM print_queue WHERE status IN ('queued', 'processing')`,
      );
      const count = rows?.[0]?.cnt || 0;
      if (count > 0) {
        this.logger(`Resetting ${count} stale print jobs to queued`);
        await runQuery(`UPDATE print_queue SET status = 'queued', processed_at = NULL WHERE status = 'processing'`);
      }
    } catch (err) {
      this.logger("Flush failed:", err.message);
    }
  }
}

// Singleton
const printQueue = new PrintQueue();

module.exports = { printQueue, PrintQueue };
