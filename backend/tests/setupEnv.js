process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGIN = 'http://localhost:5174';
process.env.EMAIL_FLOW_LIMIT = '1000'; // testlər eyni IP-dən çox sorğu göndərir; limitin özü ayrıca testdə yoxlanılır
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.MAIL_DRIVER;
