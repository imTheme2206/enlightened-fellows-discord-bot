import { Elysia } from "elysia";
import { ChannelService } from "./service";

export const channelsRoutes = new Elysia().get("/channels", () =>
  ChannelService.getAll(),
);
