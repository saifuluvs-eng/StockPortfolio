
import handler from './api/handler';
import app from './server/index';

console.log("Attempting to import api/handler...");

try {
    if (app) {
        console.log("Server app imported successfully.");
    }
    console.log("Handler imported successfully.");
    console.log("Boot check passed!");
    process.exit(0);
} catch (error) {
    console.error("Boot check FAILED:", error);
    process.exit(1);
}
