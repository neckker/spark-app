// server.rs
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tungstenite::{accept, Message};

pub type PendingUrl = Arc<Mutex<Option<String>>>;

pub fn start(pending: PendingUrl) {
    std::thread::spawn(move || {
        let listener = TcpListener::bind("127.0.0.1:7842").expect("Failed to bind");
        for stream in listener.incoming() {
            let pending = pending.clone();
            std::thread::spawn(move || {
                let stream = match stream {
                    Ok(s) => s,
                    Err(_) => return,
                };
                let _ = stream.set_read_timeout(None);
                let _ = stream.set_write_timeout(None);

                let mut ws = match accept(stream) {
                    Ok(w) => w,
                    Err(_) => return,
                };

                loop {
                    match ws.read() {
                        Ok(Message::Text(_)) | Ok(Message::Ping(_)) => {
                            let url = pending.lock().unwrap().take();
                            let body = match url {
                                Some(u) => format!(r#"{{"url":"{}"}}"#, u),
                                None => r#"{"url":null}"#.to_string(),
                            };
                            if ws.send(Message::Text(body.into())).is_err() {
                                break;
                            }
                        }
                        Ok(Message::Pong(_)) | Ok(Message::Binary(_)) | Ok(Message::Frame(_)) => continue,
                        Ok(Message::Close(_)) => break,
                        Err(e) => {
                            eprintln!("[ws] read error: {:?}", e);
                            break;
                        }
                    }
                }
            });
        }
    });
}
