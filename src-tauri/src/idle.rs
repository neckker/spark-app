use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const IDLE_THRESHOLD_SECS: u64 = 15 * 60;
const POLL_ACTIVE: Duration = Duration::from_secs(30);
const POLL_IDLE: Duration = Duration::from_secs(5);

pub type FeedActive = Arc<(Mutex<bool>, Condvar)>;

pub fn new_state() -> FeedActive {
    Arc::new((Mutex::new(false), Condvar::new()))
}

pub fn set_active(state: &FeedActive, active: bool) {
    let (lock, cvar) = &**state;
    *lock.lock().unwrap() = active;
    cvar.notify_all();
}

pub fn watch(app: AppHandle, state: FeedActive) {
    std::thread::spawn(move || {
        let (lock, cvar) = &*state;
        let mut idle = false;
        loop {
            {
                let mut active = lock.lock().unwrap();
                while !*active {
                    idle = false;
                    active = cvar.wait(active).unwrap();
                }
            }

            std::thread::sleep(if idle { POLL_IDLE } else { POLL_ACTIVE });

            if !*lock.lock().unwrap() {
                continue;
            }

            let seconds = user_idle::UserIdle::get_time()
                .map(|time| time.as_seconds())
                .unwrap_or(0);

            let now_idle = seconds >= IDLE_THRESHOLD_SECS;
            if now_idle != idle {
                idle = now_idle;
                let _ = app.emit("idle-changed", idle);
            }
        }
    });
}
