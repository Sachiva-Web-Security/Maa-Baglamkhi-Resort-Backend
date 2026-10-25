// ZKTeco / ESSL attendance machines speak a line-based packet protocol over
// TCP (default port 4380). Each packet:
//
//   "CMD,<param1>,<param2>,<param3>" + String(checksum("CMD,<param1>,<param2>,<param3>"))
//
// where checksum(text) = (sum of every ASCII byte) & 0xFF. The device answers
// with ACK / NAK followed by its own checksum, then a result line. All
// commands below target the classic fingerprint machines (V380 / F18 / KQ series).

const net = require('net')

const ZK_PORT = 4380
const SOCKET_TIMEOUT_MS = 15000

const pad2 = (value) => String(value).padStart(2, '0')

/** (sum of ASCII bytes of text) & 0xFF */
function checksum(text) {
  let total = 0
  for (let i = 0; i < text.length; i += 1) {
    total = (total + text.charCodeAt(i)) & 0xFF
  }
  return total
}

function buildPacket(command, ...params) {
  const body = [command, ...params].join(',')
  return `${body}${checksum(body)}`
}

/**
 * "2026-10-24 20:15:09" -> { year, month, day, hour, minute, second }
 * Throws when the text is not a device timestamp.
 */
function parseTimestamp(text) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(String(text).trim())
  if (!m) {
    throw new Error(`Unparseable ZK timestamp: "${text}"`)
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6])
  }
}

function formatTimestamp(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ` +
    `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`
}

/** Strip the leading ACK/NAK reply line; result lines follow it. */
function splitResultLines(raw) {
  return String(raw)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(ACK|NAK)(,|$)/i.test(line))
}

function openSocket({ host, port, timeoutMs = SOCKET_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(error)
    }

    socket.setTimeout(timeoutMs)
    socket.on('timeout', () => fail(new Error(`ZK socket timed out after ${timeoutMs} ms`)))
    socket.on('error', (error) => fail(error))
    socket.connect(port, host, () => {
      if (settled) return
      settled = true
      socket.setTimeout(0) // connection made; command timeouts are enforced below
      resolve(socket)
    })
  })
}

/**
 * Exchange one packet with the device. `send` writes the packet and collects
 * the device's byte stream until it goes quiet for 800 ms.
 */
function exchange(socket, packet) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    let finished = false
    let quietTimer = null

    const finish = (error, data) => {
      if (finished) return
      finished = true
      if (quietTimer) clearTimeout(quietTimer)
      socket.removeListener('data', onData)
      socket.removeListener('error', onSocketError)
      if (error) reject(error)
      else resolve(data)
    }

    const onData = (chunk) => {
      buffer += chunk.toString('binary')
      if (quietTimer) clearTimeout(quietTimer)
      quietTimer = setTimeout(() => {
        finish(
          /^NAK/i.test(buffer) ? new Error(`ZK device answered NAK: ${buffer.slice(0, 120)}`) : null,
          buffer
        )
      }, 800)
    }

    const onSocketError = (error) => finish(error)

    socket.on('data', onData)
    socket.on('error', onSocketError)

    socket.write(packet, (error) => {
      if (error && !finished) finish(error)
    })
  })
}

/**
 * Connect to one machine and run a list of commands in order. Returns the
 * combined result text of every ACKed command. The socket is always closed.
 */
async function runCommands({ host, port = ZK_PORT, commands = [], timeoutMs = SOCKET_TIMEOUT_MS }) {
  const socket = await openSocket({ host, port, timeoutMs })
  try {
    const outputs = []
    for (const packet of commands) {
      const raw = await exchange(socket, packet)
      outputs.push(splitResultLines(raw))
    }
    return outputs.flat()
  } finally {
    socket.end()
  }
}

const zk = {
  ZK_PORT,

  /** Server time: "GETTIME" -> "yyyy-MM-dd HH:mm:ss" */
  getTime() {
    return buildPacket('GETTIME')
  },

  /** "yyyy-MM-dd HH:mm:ss[,yyyy-MM-dd HH:mm:ss]" -> attendance log lines */
  getAttendanceLog(from, to) {
    return buildPacket('GETATTLOG', from, to)
  },

  /** "yyyy-MM-dd HH:mm:ss[,yyyy-MM-dd HH:mm:ss]" -> delete log lines from the device */
  clearLogs(from, to) {
    return buildPacket('CLEARDATA', from, to)
  },

  /** "yyyy-MM-dd HH:mm:ss[,yyyy-MM-dd HH:mm:ss]" -> delete fingerprint records from the device */
  clearPunchRecords(from, to) {
    return buildPacket('CLEARFP', from, to)
  },

  /** Download attendance logs, optional follow-up delete on the device. */
  async pullLogs(machine, { from, to, deleteAfter = false } = {}) {
    const commands = [
      this.getTime(),
      this.getAttendanceLog(from, to)
    ]
    if (deleteAfter) commands.push(this.clearLogs(from, to))

    const lines = await runCommands({
      host: machine.machineIp,
      port: Number(machine.machinePort) || ZK_PORT,
      commands,
      timeoutMs: Number(machine.timeoutMs) || SOCKET_TIMEOUT_MS
    })

    // The first command's reply is the machine clock; the rest are log lines
    // (or empty when the device holds no records in the window).
    const machineTime = lines[0] || null
    const rawLogs = lines.slice(1).filter(Boolean)
    return { machineTime, rawLogs, machineTimeParsed: machineTime ? parseTimestamp(machineTime) : null }
  },

  /**
   * Verify the machine clock against the server. Returns { deviceTime, serverTime,
   * driftSeconds } — an operator sets the shift split relative to this clock.
   */
  async verifyTime(machine) {
    const lines = await runCommands({
      host: machine.machineIp,
      port: Number(machine.machinePort) || ZK_PORT,
      commands: [this.getTime()]
    })
    const deviceText = lines[0]
    if (!deviceText) return { deviceTime: null, driftSeconds: null }
    const device = parseTimestamp(deviceText)
    const now = new Date()
    const server = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds()
    }
    const toEpoch = (parts) => new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)).getTime()
    return {
      deviceTime: deviceText,
      serverTime: formatTimestamp(server),
      driftSeconds: Math.round((toEpoch(device) - toEpoch(server)) / 1000)
    }
  }
}

module.exports = {
  checksum,
  buildPacket,
  parseTimestamp,
  formatTimestamp,
  splitResultLines,
  runCommands,
  openSocket,
  exchange,
  zk,
  ZK_PORT
}
