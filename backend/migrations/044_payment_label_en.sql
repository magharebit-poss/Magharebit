-- Add English label column to payment_method_config
ALTER TABLE payment_method_config
  ADD COLUMN IF NOT EXISTS label_en TEXT;

-- Fill English labels for the dev/test tenant seed rows
UPDATE payment_method_config
SET label_en = CASE method
  WHEN 'cash'                 THEN 'Cash'
  WHEN 'card_cmi'             THEN 'CMI Card'
  WHEN 'card_visa'            THEN 'Visa Card'
  WHEN 'card_mastercard'      THEN 'Mastercard'
  WHEN 'mobile_cih'           THEN 'CIH Direct'
  WHEN 'mobile_cih_pay'       THEN 'CIH Pay'
  WHEN 'mobile_orange_money'  THEN 'Orange Money'
  WHEN 'mobile_inwi_money'    THEN 'inwi Money'
  WHEN 'credit'               THEN 'Customer credit'
  WHEN 'voucher'              THEN 'Voucher'
  WHEN 'lana'                 THEN 'Lana Cash'
  ELSE NULL
END
WHERE label_en IS NULL;
