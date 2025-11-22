// dist/server.js (Cloud Run ready)
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { router } from "./router.js";

const PORT = process.env.PORT || 8080;

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api")) {
      await router(req, res);
      return;
    }

    let filePath = join(process.cwd(), "dist", req.url === "/" ? "index.html" : req.url!);

    if (!existsSync(filePath)) {
      filePath = join(process.cwd(), "dist", "index.html");
    }

    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(content);

  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Internal server error" }));
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
