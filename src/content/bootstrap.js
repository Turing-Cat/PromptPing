import { replaceContentScriptInstance } from "./boot-instance.js";
import { bootContentScript } from "./runtime.js";

replaceContentScriptInstance({ bootContentScript });
