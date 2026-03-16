import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("lobby/:sessionId", "routes/lobby.tsx"),
    route("game/:sessionId", "routes/game.tsx"),
    route("admin", "routes/admin.tsx"),
] satisfies RouteConfig;
