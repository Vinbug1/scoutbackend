import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://scoutbackend-xm5k.onrender.com"
    : "http://localhost:4000";

// Debug log to confirm paths are resolving correctly
console.log("📁 Swagger scanning routes at:", path.resolve(__dirname, "../routes/*.js"));
console.log("🌍 Swagger base URL:", baseUrl);

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Scouter API Documentation",
    version: "1.0.0",
    description: "API documentation for Scouter backend system",
    contact: {
      name: "Scouter Team",
      email: "info@scouter.com"
    }
  },
  servers: [
    {
      url: baseUrl,
      description:
        process.env.NODE_ENV === "production"
          ? "Production server"
          : "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: [
    path.resolve(__dirname, "../routes/*.js"),      // src/routes/*.js
    path.resolve(__dirname, "../routes/**/*.js"),   // src/routes/sub-folders
  ],
};

const swaggerSpec = swaggerJSDoc(options);

// Debug: confirm swagger found some endpoints
console.log("📚 Swagger paths found:", Object.keys(swaggerSpec.paths || {}).length);

export default swaggerSpec;