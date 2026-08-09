// Thin wrapper: green-access pipeline lives in Python (backend/build_green_access.py)
// because shapely grid sampling is simpler there than in Node.
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const py = path.join(root, "venv", "bin", "python");
const script = path.join(root, "backend", "build_green_access.py");

const child = spawn(py, [script], { cwd: root, stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
