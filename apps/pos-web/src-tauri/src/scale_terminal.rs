// scale_terminal.rs — Weighing Scale Integration
// ================================================
// This module defines the interface between
// Magharebit POS and physical weighing scales.
//
// DRIVER STATUS:
//   DIBAL D-900/D-POS:   RS-232 IMPLEMENTED
//   Brecknell B140:      RS-232 IMPLEMENTED
//   All other models:    STUB — protocol pending
//
// Integration boundary:
//   - POS (TypeScript) calls these Tauri commands
//   - This module translates to/from scale protocol
//   - Connection: RS-232 via serialport crate
//   - New scale driver = implement a connect/read
//     pair + register in scale_connect / scale_read_weight
//
// Port config comes from ScaleConfig passed by
// the frontend — never hardcoded.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serialport::SerialPort;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ── Request / Response types (mirror scale-terminal.ts) ──────────────────────

/// Connection parameters for a scale, supplied by the frontend from the
/// SCALE_CATALOG entry plus the merchant's port. Never hardcoded here.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScaleConfig {
    /// Catalog id, e.g. "dibal-d900". Selects the driver.
    pub scale_id: String,
    /// OS serial port, e.g. "COM3" (Windows) or "/dev/ttyUSB0" (Linux).
    pub port: String,
    /// Serial baud rate — 9600 for all currently-supported scales.
    pub baud_rate: u32,
    /// Read timeout in milliseconds (2000 typical).
    pub timeout_ms: u64,
}

/// A single weight reading parsed from the scale's output frame.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeightReading {
    /// Weight in grams.
    pub grams: f64,
    /// True when the scale reports a stable (settled) reading.
    pub stable: bool,
    /// Raw frame text received from the scale (for diagnostics).
    pub raw: String,
    /// Catalog id of the scale that produced the reading.
    pub scale_id: String,
    /// ISO-8601 timestamp of the read.
    pub read_at: String,
}

/// Scale command result, tagged by status for a serde discriminated union.
/// The TypeScript ScaleResponse type in scale-terminal.ts mirrors this exactly.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "status")]
pub enum ScaleResponse {
    Connected { scale_id: String, port: String },
    Disconnected,
    Reading(WeightReading),
    Error { message: String },
    Unstable { grams: f64 },
}

// ── Per-driver open-port state ───────────────────────────────────────────────
//
// The serial port MUST outlive scale_connect so that scale_read_weight has an
// open handle to read from. A local variable would drop (and close the port) at
// the end of connect. Each driver therefore stores its port in a process-wide
// Lazy<Mutex<Option<Box<dyn SerialPort + Send>>>>. serialport is synchronous, so
// std::sync::Mutex (not tokio) is correct here.

static DIBAL_PORT: Lazy<Mutex<Option<Box<dyn SerialPort + Send>>>> =
    Lazy::new(|| Mutex::new(None));

static BRECKNELL_PORT: Lazy<Mutex<Option<Box<dyn SerialPort + Send>>>> =
    Lazy::new(|| Mutex::new(None));

fn iso_now() -> String {
    // Minimal ISO-8601 (UTC seconds since epoch rendered as RFC3339-ish).
    // Avoids pulling chrono; the frontend only displays this for diagnostics.
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}Z", secs) // epoch-seconds marker; frontend uses its own clock for display
}

/// Open a serial port with the given config. Shared by both real drivers.
/// Uses open_native() so the returned concrete port type is `Send` (required to
/// store it in the process-wide Mutex); it is then boxed to the trait object.
fn open_port(config: &ScaleConfig) -> Result<Box<dyn SerialPort + Send>, String> {
    let native = serialport::new(&config.port, config.baud_rate)
        .data_bits(serialport::DataBits::Eight)
        .parity(serialport::Parity::None)
        .stop_bits(serialport::StopBits::One)
        .timeout(Duration::from_millis(config.timeout_ms))
        .open_native()
        .map_err(|e| format!("Failed to open {} @ {} baud: {}", config.port, config.baud_rate, e))?;
    Ok(Box::new(native) as Box<dyn SerialPort + Send>)
}

/// Read from an open port until `end` byte is seen or the buffer fills.
/// Returns the collected bytes (excluding nothing — caller parses).
fn read_frame(port: &mut dyn SerialPort, end: u8, max: usize) -> Result<Vec<u8>, String> {
    let mut buf: Vec<u8> = Vec::with_capacity(max);
    let mut byte = [0u8; 1];
    while buf.len() < max {
        match port.read(&mut byte) {
            Ok(0) => break,
            Ok(_) => {
                buf.push(byte[0]);
                if byte[0] == end {
                    break;
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => break,
            Err(e) => return Err(format!("serial read error: {}", e)),
        }
    }
    Ok(buf)
}

// ── DIBAL RS-232 driver (D-900 / D-POS) ──────────────────────────────────────
//
// DIBAL D-900/D-POS continuous output at 9600 baud, 8N1. Frame:
//   <STX> [6 weight digits] [unit] [status] <ETX>
//   STX = 0x02, ETX = 0x03
//   6 ASCII digits, right-justified  e.g. "001250" = 1250 grams
//   unit   'k' = kg, 'g' = grams
//   status ' ' = stable, 'M' = motion/unstable
mod dibal_driver {
    use super::*;

    const STX: u8 = 0x02;
    const ETX: u8 = 0x03;

    pub fn connect(config: &ScaleConfig) -> Result<ScaleResponse, String> {
        let port = open_port(config)?;
        let mut guard = DIBAL_PORT.lock().map_err(|e| e.to_string())?;
        *guard = Some(port);
        Ok(ScaleResponse::Connected {
            scale_id: config.scale_id.clone(),
            port: config.port.clone(),
        })
    }

    pub fn read_weight(scale_id: &str) -> Result<ScaleResponse, String> {
        let mut guard = DIBAL_PORT.lock().map_err(|e| e.to_string())?;
        let port = guard
            .as_mut()
            .ok_or_else(|| "DIBAL scale not connected".to_string())?;

        // Read one full STX..ETX frame (32-byte cap guards a garbled stream).
        let bytes = read_frame(port.as_mut(), ETX, 32)?;
        parse_frame(&bytes, scale_id)
    }

    pub fn disconnect() -> Result<(), String> {
        let mut guard = DIBAL_PORT.lock().map_err(|e| e.to_string())?;
        *guard = None; // dropping the Box closes the port
        Ok(())
    }

    pub fn is_connected() -> bool {
        DIBAL_PORT.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    fn parse_frame(bytes: &[u8], scale_id: &str) -> Result<ScaleResponse, String> {
        let raw = String::from_utf8_lossy(bytes).to_string();
        // Locate the STX..ETX window inside whatever we captured.
        let start = bytes.iter().position(|&b| b == STX);
        let stx = match start {
            Some(i) => i + 1,
            None => return Err(format!("DIBAL: no STX in frame: {:?}", raw)),
        };
        let etx = bytes[stx..]
            .iter()
            .position(|&b| b == ETX)
            .map(|i| stx + i)
            .ok_or_else(|| format!("DIBAL: no ETX in frame: {:?}", raw))?;

        let body = &bytes[stx..etx];
        // Need at least 6 digits + unit + status.
        if body.len() < 8 {
            return Err(format!("DIBAL: short frame ({} bytes): {:?}", body.len(), raw));
        }
        let digits: String = body[0..6].iter().map(|&b| b as char).collect();
        let unit = body[6] as char;
        let status = body[7] as char;

        let value: f64 = digits
            .trim()
            .parse()
            .map_err(|_| format!("DIBAL: bad digits {:?}", digits))?;
        let grams = if unit == 'k' { value * 1000.0 } else { value };
        let stable = status != 'M';

        if !stable {
            return Ok(ScaleResponse::Unstable { grams });
        }
        Ok(ScaleResponse::Reading(WeightReading {
            grams,
            stable,
            raw,
            scale_id: scale_id.to_string(),
            read_at: iso_now(),
        }))
    }
}

// ── Brecknell RS-232 driver (B140) ───────────────────────────────────────────
//
// Brecknell B140 continuous output at 9600 baud, 8N1. Frame:
//   [sign][6 digits][ unit]\r\n
//   e.g. " 001250 g\r\n" = 1250 g stable
//        "M001250 g\r\n" = unstable / in motion
//   sign  ' ' = stable, 'M' = motion
//   unit  'g' or 'k'
mod brecknell_driver {
    use super::*;

    const LF: u8 = b'\n';

    pub fn connect(config: &ScaleConfig) -> Result<ScaleResponse, String> {
        let port = open_port(config)?;
        let mut guard = BRECKNELL_PORT.lock().map_err(|e| e.to_string())?;
        *guard = Some(port);
        Ok(ScaleResponse::Connected {
            scale_id: config.scale_id.clone(),
            port: config.port.clone(),
        })
    }

    pub fn read_weight(scale_id: &str) -> Result<ScaleResponse, String> {
        let mut guard = BRECKNELL_PORT.lock().map_err(|e| e.to_string())?;
        let port = guard
            .as_mut()
            .ok_or_else(|| "Brecknell scale not connected".to_string())?;

        // Read one line terminated by LF (cap at 32 bytes).
        let bytes = read_frame(port.as_mut(), LF, 32)?;
        parse_frame(&bytes, scale_id)
    }

    pub fn disconnect() -> Result<(), String> {
        let mut guard = BRECKNELL_PORT.lock().map_err(|e| e.to_string())?;
        *guard = None;
        Ok(())
    }

    pub fn is_connected() -> bool {
        BRECKNELL_PORT.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    fn parse_frame(bytes: &[u8], scale_id: &str) -> Result<ScaleResponse, String> {
        let raw = String::from_utf8_lossy(bytes).to_string();
        let line = raw.trim_end_matches(['\r', '\n']);
        if line.len() < 8 {
            return Err(format!("Brecknell: short frame: {:?}", raw));
        }
        let chars: Vec<char> = line.chars().collect();
        let sign = chars[0];
        let digits: String = chars[1..7].iter().collect();
        // Unit is the first non-space char after the digits.
        let unit = chars[7..].iter().find(|c| !c.is_whitespace()).copied().unwrap_or('g');

        let value: f64 = digits
            .trim()
            .parse()
            .map_err(|_| format!("Brecknell: bad digits {:?}", digits))?;
        let grams = if unit == 'k' { value * 1000.0 } else { value };
        let stable = sign != 'M';

        if !stable {
            return Ok(ScaleResponse::Unstable { grams });
        }
        Ok(ScaleResponse::Reading(WeightReading {
            grams,
            stable,
            raw,
            scale_id: scale_id.to_string(),
            read_at: iso_now(),
        }))
    }
}

// ── Tauri commands (four — mirrors card_terminal.rs) ─────────────────────────

/// Connects to the scale on the configured port and dispatches to the correct
/// driver based on the catalog id prefix. Real drivers open the serial port and
/// store the handle in module state; unknown models return an Error response.
#[tauri::command]
pub async fn scale_connect(config: ScaleConfig) -> Result<ScaleResponse, String> {
    if config.scale_id.starts_with("dibal-") {
        dibal_driver::connect(&config)
    } else if config.scale_id.starts_with("brecknell-") {
        brecknell_driver::connect(&config)
    } else {
        // No driver for this model yet — surface a clear, actionable error.
        Ok(ScaleResponse::Error {
            message: "Driver not implemented for this scale model. Contact support.".to_string(),
        })
    }
}

/// Reads the current weight from the connected scale. The scale must have been
/// connected first via scale_connect. Dispatches to the correct driver.
#[tauri::command]
pub async fn scale_read_weight(scale_id: String) -> Result<ScaleResponse, String> {
    if scale_id.starts_with("dibal-") {
        dibal_driver::read_weight(&scale_id)
    } else if scale_id.starts_with("brecknell-") {
        brecknell_driver::read_weight(&scale_id)
    } else {
        Ok(ScaleResponse::Error {
            message: "Driver not implemented for this scale model. Contact support.".to_string(),
        })
    }
}

/// Closes the serial port connection for the given scale.
#[tauri::command]
pub async fn scale_disconnect(scale_id: String) -> Result<(), String> {
    if scale_id.starts_with("dibal-") {
        dibal_driver::disconnect()
    } else if scale_id.starts_with("brecknell-") {
        brecknell_driver::disconnect()
    } else {
        Ok(())
    }
}

/// Returns true if the scale is connected and its port handle is open.
/// Used for the UI status indicator. Unknown models are never "connected".
#[tauri::command]
pub async fn scale_status(scale_id: String) -> Result<bool, String> {
    if scale_id.starts_with("dibal-") {
        Ok(dibal_driver::is_connected())
    } else if scale_id.starts_with("brecknell-") {
        Ok(brecknell_driver::is_connected())
    } else {
        Ok(false)
    }
}
