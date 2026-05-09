-- Hora diaria de comprobación automática por alerta
ALTER TABLE alerts ADD COLUMN check_time TIME DEFAULT '09:00:00';
