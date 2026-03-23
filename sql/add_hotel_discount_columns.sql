ALTER TABLE advance_payment
ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount;

ALTER TABLE payment_history
ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount;
