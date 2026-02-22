// server.rs
use std::net::TcpListener;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tungstenite::{accept, Message};

/// Handle shared between Tauri commands and WebSocket server.
/// Contains the Sender end of an mpsc channel to the active client thread.
pub type UrlSenderHandle = Arc<Mutex<Option<mpsc::Sender<String>>>>;

pub fn start(handle: UrlSenderHandle) {
    std::thread::spawn(move || {
        let listener = TcpListener::bind("127.0.0.1:7842").expect("Failed to bind");
        for stream in listener.incoming() {
            let handle = handle.clone();
            std::thread::spawn(move || {
                let stream = match stream {
                    Ok(s) => s,
                    Err(_) => return,
                };

                // Short read timeout so drain_control_frames doesn't block
                let _ = stream.set_read_timeout(Some(Duration::from_millis(50)));
                let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

                let mut ws = match accept(stream) {
                    Ok(w) => w,
                    Err(_) => return,
                };

                // Create a channel for this client connection
                let (tx, rx) = mpsc::channel::<String>();

                // Register this client's sender (replaces any previous one;
                // the old client thread will get Disconnected on its rx)
                *handle.lock().unwrap() = Some(tx);

                loop {
                    match rx.recv_timeout(Duration::from_secs(30)) {
                        Ok(url) => {
                            let body = format!(r#"{{"url":"{}"}}"#, url);
                            if ws.send(Message::Text(body.into())).is_err() {
                                break;
                            }
                        }
                        Err(mpsc::RecvTimeoutError::Timeout) => {
                            // Keepalive: send a WebSocket Ping to detect stale connections
                            if ws.send(Message::Ping(vec![].into())).is_err() {
                                break;
                            }
                        }
                        Err(mpsc::RecvTimeoutError::Disconnected) => {
                            // Sender was dropped (new client connected or app shutting down)
                            let _ = ws.close(None);
                            break;
                        }
                    }

                    // Drain pending control frames (Pong, Close) from the client
                    if !drain_control_frames(&mut ws) {
                        break;
                    }
                }
            });
        }
    });
}

/// Non-blocking drain of WebSocket control frames.
/// Returns `true` if the connection is still healthy, `false` on Close or error.
fn drain_control_frames(ws: &mut tungstenite::WebSocket<std::net::TcpStream>) -> bool {
    loop {
        match ws.read() {
            Ok(Message::Pong(_)) => continue,
            Ok(Message::Ping(data)) => {
                let _ = ws.send(Message::Pong(data));
                continue;
            }
            Ok(Message::Close(_)) => return false,
            Ok(_) => continue,
            Err(tungstenite::Error::Io(ref e))
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                return true; // No more data — expected
            }
            Err(_) => return false,
        }
    }
}
