import axios from "../api";

export const PrintService = {
  async queuePrint(printType, payload = {}, priority = 0) {
    const response = await axios.post("/print/queue", {
      printType,
      payload,
      priority,
    });
    return response.data;
  },

  async reprint(printType, invoiceNo, kotNo) {
    const response = await axios.post("/print/reprint", {
      printType,
      invoiceNo,
      kotNo,
    });
    return response.data;
  },

  async getHistory(params = {}) {
    const response = await axios.get("/print/history", { params });
    return response.data;
  },

  async getPrinterStatus(printerKey = "A4_PRINTER") {
    const response = await axios.get("/print/status", {
      params: { printerKey },
    });
    return response.data;
  },

  async getQueueStatus() {
    const response = await axios.get("/print/queue");
    return response.data;
  },

  async cancelJob(jobId) {
    const response = await axios.delete(`/print/queue/${jobId}`);
    return response.data;
  },

  async getPrintTypes() {
    const response = await axios.get("/print/types");
    return response.data;
  },

  async testPrint(printerKey, message) {
    const response = await axios.post("/print/test", {
      printerKey,
      message,
    });
    return response.data;
  },
};

export default PrintService;