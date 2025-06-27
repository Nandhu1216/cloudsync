require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const https = require('https');
const path = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudRoot = 'Zones';
const baseDir = 'D:/Zones';

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
        });
    });
}

function extractFolderInfo(publicId) {
    const parts = publicId.split('/');
    if (parts.length < 7) return null;
    return {
        zone: parts[1],
        supervisor: parts[2],
        category: parts[3],
        ward: parts[4],
        date: parts[5],
        filename: parts[6],
    };
}

async function downloadAllImages() {
    console.log(`🕒 Sync started at ${new Date().toLocaleString()}`);
    try {
        const result = await cloudinary.search
            .expression(`folder:${cloudRoot}/*`)
            .max_results(500)
            .execute();

        const resources = result.resources || [];

        for (const resource of resources) {
            const url = resource.secure_url;
            const publicId = resource.public_id;
            const ext = path.extname(url.split('?')[0]) || '.jpg';

            const info = extractFolderInfo(publicId);
            if (!info) continue;

            const { zone, supervisor, category, ward, date, filename } = info;

            const fullPath = path.join(baseDir, zone, supervisor, category, ward, date);
            const fullFile = path.join(fullPath, `${filename}${ext}`);

            const dailyPath = path.join(baseDir, 'dailywork', date, category);
            const dailyFile = path.join(dailyPath, `${filename}${ext}`);

            if (fs.existsSync(fullFile) && fs.existsSync(dailyFile)) {
                console.log(`⏩ Skipped: ${filename}`);
                continue;
            }

            fs.mkdirSync(fullPath, { recursive: true });
            fs.mkdirSync(dailyPath, { recursive: true });

            await downloadFile(url, fullFile);
            await downloadFile(url, dailyFile);

            console.log(`✅ Downloaded: ${filename}`);
        }

        console.log(`✅ Sync completed at ${new Date().toLocaleString()}`);
    } catch (err) {
        console.error('❌ Error during download:', err.message);
    }
}

downloadAllImages();
