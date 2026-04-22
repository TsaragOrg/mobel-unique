import cors from "cors";
import express from "express";
import helmet from "helmet";

export type ApiAppOptions = {
  appEnv?: string;
  webOrigin?: string;
};

export function createApp(options: ApiAppOptions = {}) {
  const app = express();
  const appEnv = options.appEnv ?? process.env.APP_ENV ?? "local";
  const webOrigin = options.webOrigin ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";

  app.use(helmet());
  app.use(cors({ credentials: true, origin: webOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      environment: appEnv,
      service: "api",
      status: "ok"
    });
  });

  return app;
}

