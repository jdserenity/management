use std::collections::HashMap;

#[derive(serde::Serialize)]
pub struct SyncHttpResponse {
    status: u16,
    body: String,
}

#[tauri::command]
pub async fn sync_http_fetch(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<SyncHttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let req_method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("invalid method: {}", e))?;
    let mut req = client.request(req_method, &url);
    for (k, v) in headers {
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(SyncHttpResponse { status, body })
}
