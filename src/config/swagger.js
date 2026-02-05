import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine base URL based on environment
const baseUrl =
  process.env.SWAGGER_SERVER_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://scoutbackend-xm5k.onrender.com/api"
    : "http://localhost:4000");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Scouter API Documentation",
    version: "1.0.0",
    description: "API documentation for Scouter backend system",
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
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: [
    path.resolve(__dirname, "../routes/*.js"),
    path.resolve(__dirname, "../routes/**/*.js"), // Also picks up nested routes
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;