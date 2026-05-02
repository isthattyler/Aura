use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("Permission denied: {0}")]
    Permission(String),

    #[error("Platform not supported: {0}")]
    Unsupported(String),

    #[error("Scan failed: {0}")]
    ScanFailed(String),

    #[error("Clean failed: {0}")]
    CleanFailed(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid argument: {0}")]
    InvalidArg(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            AppError::Permission(e.to_string())
        } else {
            AppError::Io(e.to_string())
        }
    }
}

impl From<walkdir::Error> for AppError {
    fn from(e: walkdir::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

/// Allow AppError to be used as a Tauri command return type
impl From<AppError> for tauri::Error {
    fn from(e: AppError) -> Self {
        tauri::Error::Anyhow(anyhow::anyhow!("{}", e))
    }
}
