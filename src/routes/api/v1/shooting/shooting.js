const Router = require('express').Router();
const { db } = require('../../../../database/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// IMPORTAZIONE DEI MIDDLEWARE STRUTTURALI
const authenticateToken = require('../../../../middleware/auth'); 
const isUserAllowedToShooting = require('../../../../middleware/isUserAllowedToShooting');

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1509012361460060272/elpPtJC5hOnXNPA1qN-L3jg0YMbF_bWhYHohlsKHfKx2mq1CrIe4wpyZmPFzgvo_zbN1";
const PATH_TO_WATERMARK = path.join(__dirname, '../../../../assets/watermark_n.png'); 

const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage: storage });

// 1. ADATTATORE UNIVERSALE ED ELIMINAZIONE ERRORI DI AUTENTICAZIONE DELLA MOD
Router.use((req, res, next) => {
    console.log(`\n--- [DEBUG BACKEND] Nuova richiesta ricevuta su: ${req.method} ${req.originalUrl} ---`);
    
    // Se la mod usa lo standard Bearer (come si vede dai tuoi log), lo mappiamo su x-auth-token per il tuo vecchio middleware auth
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const tokenEstratto = req.headers.authorization.split(' ')[1];
        req.headers['x-auth-token'] = tokenEstratto;
        console.log("[DEBUG ADATTATORE] Convertito con successo l'header Bearer in x-auth-token.");
    }

    next();
});

// 2. CONFIGURAZIONE DELLE ROTTE CON LA SEQUENZA DI SICUREZZA CORRETTA
// Prima decodifichiamo il token (authenticateToken), poi controlliamo i permessi (isUserAllowedToShooting), infine eseguiamo la funzione
Router.post('/create', authenticateToken, isUserAllowedToShooting, create);
Router.post('/upload/:uuid', authenticateToken, isUserAllowedToShooting, uploadMiddleware.array('photos', 10), upload);
Router.get('/event/:uuid/photos', authenticateToken, isUserAllowedToShooting, getEventPhotosList);
Router.get('/photo/:photoId', serveSinglePhoto); // Questa non ha bisogno di token perché serve al cliente nel mirror web!
Router.post('/events/:uuid/pay', authenticateToken, markEventAsPaid);

async function create(req, res) {
    const { id, eventName, executor, client } = req.body;
    console.log(`[DEBUG CREATE] Ricevuto dal fotografo autorizzato: ${req.user.username}`);

    try {
        await db.execute({
            sql: "INSERT INTO events(uuid, event_name, executor, client, paid) VALUES (?, ?, ?, ?, 0)",
            args: [id, eventName, executor, client]
        });

        console.log(`[DEBUG CREATE] Evento '${eventName}' (${id}) salvato con successo nel database.`);
        return res.status(201).json({ message: "Event created successfully" });
    } catch (err) {
        console.error("Error creating event:", err);
        return res.status(500).json({ message: "Error creating event" });
    }
}

async function upload(req, res) {
    const { uuid } = req.params;
    console.log(`[DEBUG UPLOAD] Caricamento foto in corso per l'evento UUID: ${uuid} da parte di: ${req.user.username}`);

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
    }

    try {
        const result = await db.execute({
            sql: "SELECT * FROM events WHERE uuid = ?",
            args: [uuid]
        });

        if (result.rows.length === 0) {
            console.log(`[DEBUG UPLOAD] Errore: L'evento ${uuid} non esiste a database.`);
            return res.status(404).json({ message: "Event not found" });
        }

        const uploadedUrls = [];

        for (const file of req.files) {
            const form = new FormData();
            form.append('content', `Nuova foto originale per l'evento: **${uuid}**`);
            form.append('files[0]', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype,
                knownLength: file.buffer.length
            });
            
            const discordResponse = await axios.post(DISCORD_WEBHOOK_URL, form, {
                headers: form.getHeaders()
            });
            
            if (!discordResponse.data.attachments || discordResponse.data.attachments.length === 0) {
                throw new Error("Discord received the request but didn't save the file attachment.");
            }
            
            uploadedUrls.push(discordResponse.data.attachments[0].url);
        }

        for (const url of uploadedUrls) {
            await db.execute({
                sql: "INSERT INTO event_photos (event_uuid, photo_url) VALUES (?, ?)",
                args: [uuid, url]
            });
        }

        console.log(`[DEBUG UPLOAD] Upload completato con successo. ${uploadedUrls.length} foto registrate.`);
        return res.status(200).json({ message: "Original photos uploaded successfully" });

    } catch (error) {
        console.error("Upload process error:", error);
        return res.status(500).json({ message: "Upload failed" });
    }
}

async function getEventPhotosList(req, res) {
    const { uuid } = req.params;

    try {
        const result = await db.execute({
            sql: "SELECT id FROM event_photos WHERE event_uuid = ?",
            args: [uuid]
        });

        if (result.rows.length === 0) {
            return res.status(200).json({ photos: [] });
        }

        const photoLinks = result.rows.map(row => `/api/v1/shooting/photo/${row.id}`);

        return res.status(200).json({
            uuid: uuid,
            photos: photoLinks
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
    }
}

// async function serveSinglePhoto(req, res) {
//     const { photoId } = req.params;

//     const query = `
//         SELECT ep.photo_url, e.paid 
//         FROM event_photos ep
//         JOIN events e ON ep.event_uuid = e.uuid
//         WHERE ep.id = ?
//     `;

//     try {
//         const result = await db.execute({
//             sql: query,
//             args: [photoId]
//         });

//         if (result.rows.length === 0) {
//             return res.status(404).send("Photo not found");
//         }

//         const { photo_url, paid } = result.rows[0];

//         const response = await globalThis.fetch(photo_url);
//         if (!response.ok) return res.status(500).send("Error fetching source image");
        
//         const imageBuffer = Buffer.from(await response.arrayBuffer());

//         res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
        
//         if (Number(paid) === 0) {
//             const image = sharp(imageBuffer);
//             const metadata = await image.metadata();

//             const watermarkWidth = Math.floor(metadata.width * 0.20);
//             const resizedWatermark = await sharp(PATH_TO_WATERMARK)
//                 .resize({ width: watermarkWidth })
//                 .toBuffer();

//             const watermarkedBuffer = await image
//                 .composite([{ 
//                     input: resizedWatermark, 
//                     tile: true,
//                     blend: 'over' 
//                 }])
//                 .toBuffer();

//             return res.send(watermarkedBuffer);
//         }

//         return res.send(imageBuffer);

//     } catch (error) {
//         console.error(error);
//         return res.status(500).send("Error processing image");
//     }
// }
async function serveSinglePhoto(req, res) {
    const { photoId } = req.params;

    const query = `
        SELECT ep.photo_url, e.paid 
        FROM event_photos ep
        JOIN events e ON ep.event_uuid = e.uuid
        WHERE ep.id = ?
    `;

    try {
        const result = await db.execute({
            sql: query,
            args: [photoId]
        });

        if (result.rows.length === 0) {
            return res.status(404).send("Photo not found");
        }

        const { photo_url, paid } = result.rows[0];

        const response = await globalThis.fetch(photo_url);
        if (!response.ok) return res.status(500).send("Error fetching source image");
        
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        if (Number(paid) === 0) {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            const watermarkWidth = Math.floor(metadata.width * 0.20);
            const resizedWatermark = await sharp(PATH_TO_WATERMARK)
                .resize({ width: watermarkWidth })
                .toBuffer();

            const watermarkedBuffer = await image
                .composite([{ 
                    input: resizedWatermark, 
                    tile: true,
                    blend: 'over' 
                }])
                .jpeg({ quality: 80, chromaSubsampling: '4:2:0' })
                .toBuffer();

            res.setHeader('Content-Type', 'image/jpeg');
            return res.send(watermarkedBuffer);
        }

        const optimizedCleanBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 90 }) 
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(optimizedCleanBuffer);

    } catch (error) {
        console.error("Errore durante il processing dell'immagine:", error);
        return res.status(500).send("Error processing image");
    }
}
async function markEventAsPaid(req, res) {
    const { uuid } = req.params;

    try {
        const eventCheck = await db.execute({
            sql: "SELECT event_name, executor, client, paid FROM events WHERE uuid = ?",
            args: [uuid]
        });

        if (eventCheck.rows.length === 0) {
            return res.status(404).send("Event not found");
        }

        const event = eventCheck.rows[0];

        if (Number(event.paid) === 1) {
            return res.status(200).send("Event was already verified and paid.");
        }

        await db.execute({
            sql: "UPDATE events SET paid = 1 WHERE uuid = ?",
            args: [uuid]
        });

        const userCheck = await db.execute({
            sql: "SELECT id FROM users WHERE username = ? OR mc_nick = ?",
            args: [event.executor, event.executor]
        });

        let numericExecutorId = null;
        if (userCheck.rows.length > 0) {
            numericExecutorId = userCheck.rows[0].id;
        }

        await db.execute({
            sql: "INSERT INTO payments (type, executor, import, client, notes) VALUES (?, ?, ?, ?, ?)",
            args: [
                'Servizio Fotografico',                     
                numericExecutorId,                           
                75.00,                                       
                event.client,                                
                `Sblocco automatico watermark evento: ${event.event_name}`
            ]
        });

        return res.status(200).send("Event updated successfully and revenue tracked!");

    } catch (error) {
        console.error("Error processing request inside markEventAsPaid:", error);
        return res.status(500).send("Error processing request");
    }
}

module.exports = Router;