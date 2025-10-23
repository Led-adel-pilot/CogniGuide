import { createRequire } from "module";

const require = createRequire(import.meta.url);

const config = require("./postcss.config.cjs");

export default config;
