use std::net::TcpListener;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tungstenite::{accept, Message};

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

                let _ = stream.set_read_timeout(Some(Duration::from_millis(50)));
                let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

                let mut ws = match accept(stream) {
                    Ok(w) => w,
                    Err(_) => return,
                };

                let (tx, rx) = mpsc::channel::<String>();

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
                            if ws.send(Message::Ping(vec![].into())).is_err() {
                                break;
                            }
                        }
                        Err(mpsc::RecvTimeoutError::Disconnected) => {
                            let _ = ws.close(None);
                            break;
                        }
                    }

                    if !drain_control_frames(&mut ws) {
                        break;
                    }
                }
            });
        }
    });
}

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
                return true;
            }
            Err(_) => return false,
        }
    }
}
