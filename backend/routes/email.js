const express = require('express');
const multer = require('multer');
const { sendEmails } = require('../services/emailService');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Basic in-memory store for tracking job progress (for a real app, use Redis/DB)
const jobs = new Map();

router.post('/send', upload.array('attachments'), async (req, res) => {
    try {
        const { smtpUser, smtpPass, subjectTemplate, bodyTemplate, recipients: recipientsStr } = req.body;

        if (!smtpUser || !smtpPass) {
            return res.status(400).json({ error: 'SMTP credentials missing' });
        }

        const recipients = JSON.parse(recipientsStr || '[]');
        if (recipients.length === 0) {
            return res.status(400).json({ error: 'No recipients provided' });
        }

        const jobId = Date.now().toString();
        jobs.set(jobId, { status: 'processing', progress: 0, total: recipients.length, results: [] });

        // Start processing asynchronously
        res.status(202).json({ message: 'Email batch processing started', jobId });

        // Process in background
        sendEmails(
            { smtpUser, smtpPass },
            recipients,
            req.files,
            subjectTemplate,
            bodyTemplate,
            (progressUpdate) => {
                const job = jobs.get(jobId);
                job.progress = progressUpdate.index + 1;
                job.results.push(progressUpdate);
            }
        ).then((results) => {
            const job = jobs.get(jobId);
            job.status = 'completed';

            // Clean up uploaded files after sending
            if (req.files) {
                for (const file of req.files) {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error deleting temp file ${file.path}:`, err);
                    });
                }
            }
        }).catch((err) => {
            console.error('Batch email error: ', err);
            const job = jobs.get(jobId);
            job.status = 'failed';
            job.error = err.message;
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

router.get('/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
});

module.exports = router;
