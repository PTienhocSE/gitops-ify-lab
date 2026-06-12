const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.GOOGLE_MAILER_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MAILER_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_MAILER_REFRESH_TOKEN;
const FROM_EMAIL = process.env.ADMIN_EMAIL_ADDRESS || 'kickslabss@gmail.com';
const FROM_NAME = process.env.FROM_NAME || 'AWS Alertmanager';
const TO_EMAIL = process.env.TO_EMAIL || 'ptientr.dev@gmail.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: FROM_EMAIL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN
  }
});

app.post('/alert', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Alertmanager webhook payload:', JSON.stringify(payload, null, 2));

    if (!payload.alerts || payload.alerts.length === 0) {
      return res.status(200).send('No alerts in payload');
    }

    // Format the email content
    let emailSubject = `[Alertmanager] ${payload.status.toUpperCase()}: ${payload.alerts.length} alert(s)`;
    if (payload.alerts.length === 1) {
      const firstAlert = payload.alerts[0];
      emailSubject = `[Alertmanager] ${firstAlert.status.toUpperCase()}: ${firstAlert.labels.alertname}`;
    }

    let emailText = `Alertmanager Status: ${payload.status.toUpperCase()}\n\n`;
    let emailHtml = `<h2>Alertmanager Status: <span style="color: ${payload.status === 'firing' ? 'red' : 'green'}">${payload.status.toUpperCase()}</span></h2>`;

    payload.alerts.forEach((alert, index) => {
      const name = alert.labels.alertname || 'Unknown Alert';
      const severity = alert.labels.severity || 'info';
      const summary = alert.annotations.summary || '';
      const description = alert.annotations.description || '';
      const status = alert.status.toUpperCase();
      const time = alert.startsAt;

      emailText += `--- Alert #${index + 1} (${status}) ---\n`;
      emailText += `Alert Name: ${name}\n`;
      emailText += `Severity: ${severity}\n`;
      emailText += `Summary: ${summary}\n`;
      emailText += `Description: ${description}\n`;
      emailText += `Time: ${time}\n\n`;

      emailHtml += `
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background-color: ${status === 'FIRING' ? '#fff5f5' : '#f5fff5'}">
          <h3 style="margin-top: 0; color: ${status === 'FIRING' ? '#d32f2f' : '#388e3c'}">${name} - ${status}</h3>
          <p><strong>Severity:</strong> <span style="text-transform: uppercase; font-weight: bold;">${severity}</span></p>
          <p><strong>Summary:</strong> ${summary}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Time:</strong> ${time}</p>
        </div>
      `;
    });

    console.log(`Sending alert email to ${TO_EMAIL}...`);
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject: emailSubject,
      text: emailText,
      html: emailHtml
    });

    console.log('Email sent successfully');
    res.status(200).send('Alert email sent successfully');
  } catch (error) {
    console.error('Error sending alert email:', error);
    res.status(500).send(`Failed to send alert email: ${error.message}`);
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Alert mailer bridge listening on port ${PORT}`);
});
