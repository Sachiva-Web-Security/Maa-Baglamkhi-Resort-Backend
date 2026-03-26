CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NULL,
  action VARCHAR(100) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  http_method VARCHAR(10) NOT NULL,
  request_data JSON NULL,
  response_status INT NOT NULL,
  ip_address VARCHAR(64) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  response_body JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_user_id (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_endpoint (endpoint),
  INDEX idx_audit_created_at (created_at)
);
