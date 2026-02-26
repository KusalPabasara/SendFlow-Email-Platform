const nodemailer = require('nodemailer');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendEmails(config, recipients, attachments, subjectTemplate, bodyTemplate, onProgress) {
    const { smtpUser, smtpPass } = config;

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: smtpUser,
            pass: (smtpPass || '').replace(/\s+/g, ''), // Strip spaces automatically
        },
    });

    const results = [];

    // Throttle: 100-120 emails per minute => ~500ms between emails
    const DELAY_MS = 600;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // Basic placeholder replacement ({{name}}, {{email}}, etc.)
        let subject = subjectTemplate;
        let body = bodyTemplate;

        for (const [key, value] of Object.entries(recipient)) {
            const regex = new RegExp(`{{${key}}}`, 'gi');
            subject = subject.replace(regex, value);
            body = body.replace(regex, value);
        }

        // Find attachment matching the recipient's email or name
        const recipientAttachments = [];
        if (attachments && attachments.length > 0) {
            const matchingFile = attachments.find(file => {
                const nameMatch = file.originalname.toLowerCase().includes(String(recipient.name || '').toLowerCase());
                const emailMatch = file.originalname.toLowerCase().includes(String(recipient.email || '').toLowerCase());
                return (recipient.name && nameMatch) || (recipient.email && emailMatch);
            });

            if (matchingFile) {
                recipientAttachments.push({
                    filename: matchingFile.originalname,
                    path: matchingFile.path
                });
            }
        }

        try {
            await transporter.sendMail({
                from: smtpUser,
                to: recipient.email,
                subject: subject,
                text: body,
                attachments: recipientAttachments,
            });

            results.push({ email: recipient.email, status: 'success' });
            if (onProgress) onProgress({ email: recipient.email, status: 'success', index: i, total: recipients.length });
        } catch (error) {
            console.error(`Failed to send to ${recipient.email}:`, error);
            results.push({ email: recipient.email, status: 'error', error: error.message });
            if (onProgress) onProgress({ email: recipient.email, status: 'error', error: error.message, index: i, total: recipients.length });
        }

        // Wait before sending the next one to avoid rate limits
        if (i < recipients.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    return results;
}

module.exports = {
    sendEmails
};
