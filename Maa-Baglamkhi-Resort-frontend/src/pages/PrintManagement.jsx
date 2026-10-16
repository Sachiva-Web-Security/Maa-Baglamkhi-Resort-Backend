import { useState, useEffect } from "react";
import { Card, Table, Tag, Button, Space, message, Spin, Statistic, Row, Col, Modal, Input, Select } from "antd";
import {
  PrinterOutlined,
  ReloadOutlined,
  StopOutlined,
  RedoOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import PrintService from "../services/printService";

const { Search } = Input;
const { Option } = Select;

const PRINT_TYPE_LABELS = {
  gst_invoice: "GST Invoice",
  final_invoice: "Final Invoice",
  checkout_bill: "Checkout Bill",
  advance_payment: "Advance Payment",
  advance_receipt: "Advance Receipt",
  restaurant_bill_a4: "Restaurant Bill (A4)",
  room_service_bill_a4: "Room Service Bill (A4)",
  restaurant_pos_bill: "Restaurant POS Bill",
  room_service_bill: "Room Service Bill",
  kot: "Kitchen Order Ticket",
  cash_receipt: "Cash Receipt",
  refund_receipt: "Refund Receipt",
  payment_receipt: "Payment Receipt",
  folio_statement: "Folio Statement",
};

const STATUS_COLORS = {
  success: "green",
  failed: "red",
  queued: "orange",
  processing: "blue",
  completed: "green",
};

function PrintManagement() {
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [queue, setQueue] = useState(null);
  const [printTypes, setPrintTypes] = useState(null);
  const [printerStatus, setPrinterStatus] = useState(null);
  const [reprintModal, setReprintModal] = useState(false);
  const [testPrintModal, setTestPrintModal] = useState(false);
  const [reprintForm, setReprintForm] = useState({ printType: "gst_invoice", invoiceNo: "", kotNo: "" });
  const [testForm, setTestForm] = useState({ printerKey: "A4_PRINTER", message: "Test Print - Maa Baglamukhi Resort" });

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [historyRes, queueRes, typesRes] = await Promise.all([
        PrintService.getHistory({ limit: 50 }),
        PrintService.getQueueStatus(),
        PrintService.getPrintTypes(),
      ]);

      setHistory(historyRes.history || []);
      setQueue(queueRes);
      setPrintTypes(typesRes);
    } catch (err) {
      message.error("Failed to load print data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStatus = async () => {
    try {
      const res = await PrintService.getQueueStatus();
      setQueue(res);
    } catch {}
  };

  const loadPrinterStatus = async (printerKey) => {
    try {
      const status = await PrintService.getPrinterStatus(printerKey);
      setPrinterStatus(status);
    } catch (err) {
      message.error("Failed to check printer status: " + err.message);
    }
  };

  const handleReprint = async () => {
    if (!reprintForm.printType) {
      message.error("Select a print type");
      return;
    }
    if (!reprintForm.invoiceNo && !reprintForm.kotNo) {
      message.error("Enter an Invoice No or KOT No");
      return;
    }

    try {
      const result = await PrintService.reprint(
        reprintForm.printType,
        reprintForm.invoiceNo,
        reprintForm.kotNo
      );
      if (result.success) {
        message.success("Reprint queued successfully");
        setReprintModal(false);
        setReprintForm({ printType: "gst_invoice", invoiceNo: "", kotNo: "" });
        loadAllData();
      } else {
        message.error(result.error || "Reprint failed");
      }
    } catch (err) {
      message.error("Reprint failed: " + err.message);
    }
  };

  const handleTestPrint = async () => {
    try {
      const result = await PrintService.testPrint(testForm.printerKey, testForm.message);
      if (result.success) {
        message.success("Test print sent successfully");
        setTestPrintModal(false);
      } else {
        message.error(result.error || "Test print failed");
      }
    } catch (err) {
      message.error("Test print failed: " + err.message);
    }
  };

  const handleCancelJob = async (jobId) => {
    try {
      await PrintService.cancelJob(jobId);
      message.success("Job cancelled");
      loadQueueStatus();
    } catch (err) {
      message.error("Failed to cancel job: " + err.message);
    }
  };

  const historyColumns = [
    {
      title: "Print No",
      dataIndex: "print_no",
      key: "print_no",
      width: 150,
      render: (text) => <span style={{ fontFamily: "monospace" }}>{text}</span>,
    },
    {
      title: "Type",
      dataIndex: "print_type",
      key: "print_type",
      render: (type) => PRINT_TYPE_LABELS[type] || type,
    },
    {
      title: "Printer",
      dataIndex: "printer_name",
      key: "printer_name",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const icon =
          status === "success" ? (
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
          ) : status === "failed" ? (
            <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
          ) : status === "queued" ? (
            <ExclamationCircleOutlined style={{ color: "#faad14" }} />
          ) : (
            <CheckCircleOutlined style={{ color: "#1890ff" }} />
          );
        return (
          <Space>
            {icon}
            <Tag color={STATUS_COLORS[status] || "default"}>{status.toUpperCase()}</Tag>
          </Space>
        );
      },
    },
    {
      title: "Printed At",
      dataIndex: "printed_at",
      key: "printed_at",
      render: (date) => (date ? new Date(date).toLocaleString("en-IN") : "N/A"),
    },
    {
      title: "Error",
      dataIndex: "error_message",
      key: "error_message",
      render: (err) => (err ? <span style={{ color: "#ff4d4f" }}>{err}</span> : "-"),
    },
  ];

  const queueColumns = [
    {
      title: "Job ID",
      dataIndex: "job_id",
      key: "job_id",
      render: (text) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{text}</span>,
    },
    {
      title: "Type",
      dataIndex: "print_type",
      key: "print_type",
      render: (type) => PRINT_TYPE_LABELS[type] || type,
    },
    {
      title: "Printer",
      dataIndex: "printer_name",
      key: "printer_name",
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (p) => <Tag color={p >= 10 ? "red" : p >= 5 ? "orange" : "default"}>P{p}</Tag>,
    },
    {
      title: "Retries",
      dataIndex: "retry_count",
      key: "retry_count",
      render: (r, row) => `${r}/${row.max_retries}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={STATUS_COLORS[status] || "default"}>{status}</Tag>,
    },
    {
      title: "Action",
      key: "action",
      render: (_, row) =>
        row.status === "queued" ? (
          <Button size="small" danger onClick={() => handleCancelJob(row.job_id)} icon={<StopOutlined />}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2>
          <PrinterOutlined /> Print Management
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAllData}>Refresh</Button>
          <Button icon={<RedoOutlined />} onClick={() => setReprintModal(true)}>Reprint</Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={() => setTestPrintModal(true)}>Test Print</Button>
        </Space>
      </div>

      {/* Stats */}
      {queue && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="Queued" value={queue.counts?.queued || 0} valueStyle={{ color: "#faad14" }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Processing" value={queue.counts?.processing || 0} valueStyle={{ color: "#1890ff" }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Completed" value={queue.counts?.completed || 0} valueStyle={{ color: "#52c41a" }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Failed" value={queue.counts?.failed || 0} valueStyle={{ color: "#ff4d4f" }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Print Queue */}
      <Card title="Print Queue" style={{ marginBottom: 24 }} extra={<Button size="small" onClick={loadQueueStatus} icon={<ReloadOutlined />}>Refresh</Button>}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : queue?.recentJobs?.length > 0 ? (
          <Table columns={queueColumns} dataSource={queue.recentJobs} rowKey="job_id" pagination={false} size="small" />
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "#999" }}>No jobs in queue</div>
        )}
      </Card>

      {/* Print History */}
      <Card title="Print History" extra={<Button size="small" onClick={loadAllData} icon={<ReloadOutlined />}>Refresh</Button>}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : history.length > 0 ? (
          <Table columns={historyColumns} dataSource={history} rowKey="id" pagination={{ pageSize: 20 }} size="small" />
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "#999" }}>No print history</div>
        )}
      </Card>

      {/* Reprint Modal */}
      <Modal
        title="Reprint Document"
        open={reprintModal}
        onOk={handleReprint}
        onCancel={() => setReprintModal(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Print Type</label>
            <Select
              style={{ width: "100%" }}
              value={reprintForm.printType}
              onChange={(val) => setReprintForm({ ...reprintForm, printType: val })}
            >
              {printTypes?.types?.map((t) => (
                <Option key={t.printType} value={t.printType}>{t.label}</Option>
              ))}
            </Select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Invoice Number</label>
            <Input
              placeholder="e.g., HOTINV-20250725-0001"
              value={reprintForm.invoiceNo}
              onChange={(e) => setReprintForm({ ...reprintForm, invoiceNo: e.target.value })}
            />
          </div>
          {["kot", "kot_customer_copy"].includes(reprintForm.printType) && (
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>KOT Number</label>
              <Input
                placeholder="e.g., KOT-000152"
                value={reprintForm.kotNo}
                onChange={(e) => setReprintForm({ ...reprintForm, kotNo: e.target.value })}
              />
            </div>
          )}
        </Space>
      </Modal>

      {/* Test Print Modal */}
      <Modal
        title="Test Print"
        open={testPrintModal}
        onOk={handleTestPrint}
        onCancel={() => setTestPrintModal(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Printer</label>
            <Select
              style={{ width: "100%" }}
              value={testForm.printerKey}
              onChange={(val) => setTestForm({ ...testForm, printerKey: val })}
            >
              {printTypes?.printers?.map((p) => (
                <Option key={p.printerKey} value={p.printerKey}>{p.name} ({p.type})</Option>
              ))}
            </Select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Test Message</label>
            <Input value={testForm.message} onChange={(e) => setTestForm({ ...testForm, message: e.target.value })} />
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default PrintManagement;
