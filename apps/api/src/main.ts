import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const env = configureApp(app);
  await app.listen(env.port);
}

bootstrap().catch((error: unknown) => {
  Logger.error(safeStartError(error), "Bootstrap");
  process.exitCode = 1;
});

function safeStartError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Failed to start API";
  if (/postgres(ql)?:\/\//i.test(message) || message.includes("Bearer ")) {
    return "Failed to start API";
  }
  return message;
}
