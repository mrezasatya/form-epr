const { SMTPServer } = require('/home/user/form-epr/node_modules/smtp-server');
const { simpleParser } = require('/home/user/form-epr/node_modules/mailparser');
const fs = require('fs');
const out = process.argv[2];
fs.writeFileSync(out, '[]');
new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'], onData(stream, s, cb) {
  simpleParser(stream).then((m) => {
    const all = JSON.parse(fs.readFileSync(out));
    all.push({ to: m.to?.text, subject: m.subject, text: m.text, at: new Date().toISOString() });
    fs.writeFileSync(out, JSON.stringify(all, null, 1)); cb();
  });
} }).listen(2527, '127.0.0.1', () => console.log('smtp sink :2527'));
