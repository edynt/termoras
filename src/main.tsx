import ReactDOM from "react-dom/client";
import { App } from "./app";
import "./index.css";

// No StrictMode — xterm.js + PTY lifecycle is incompatible with
// StrictMode's double-mount behavior in development
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
