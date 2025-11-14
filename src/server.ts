import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const server = createServer((req, res) => {
  let filePath = join(process.cwd(), "dist", req.url === "/" ? "index.html" : req.url!);

  if (!existsSync(filePath)) {
    filePath = join(process.cwd(), "dist", "index.html"); 
  }

  try {
    const content = readFileSync(filePath);
    res.writeHead(200);
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(5000, () => console.log("Server running on port 5000"));
