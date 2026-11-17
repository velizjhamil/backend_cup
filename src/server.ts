import { app } from './app.js';
import { env } from './config/env.js';

// Arrancar el servidor
const start = async () => {
    try {
        await app.listen({ port: env.PORT, host: env.HOST });
        console.log(`Servidor corriendo en http://localhost:${env.PORT}`);
        console.log(`Documentación en http://localhost:${env.PORT}/docs`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
