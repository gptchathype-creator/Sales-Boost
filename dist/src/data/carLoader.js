"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCar = loadCar;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const CarSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    price_rub: zod_1.z.number(),
    brand: zod_1.z.string(),
    model: zod_1.z.string(),
    year: zod_1.z.number(),
    mileage_km: zod_1.z.number(),
    technical: zod_1.z.record(zod_1.z.unknown()),
    description: zod_1.z.record(zod_1.z.unknown()),
    deal_terms: zod_1.z.record(zod_1.z.unknown()),
    location: zod_1.z.record(zod_1.z.unknown()),
}).passthrough();
const DEFAULT_CAR_PATH = path.join(process.cwd(), 'data', 'car.json');
/**
 * Load and validate car data from JSON file.
 * Required fields: id, title, price_rub, brand, model, year, mileage_km, technical, description, deal_terms, location.
 */
function loadCar(filePath = DEFAULT_CAR_PATH) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Car file not found: ${resolved}`);
    }
    const raw = fs.readFileSync(resolved, 'utf-8');
    const data = JSON.parse(raw);
    const result = CarSchema.safeParse(data);
    if (!result.success) {
        const msg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Invalid car.json: ${msg}`);
    }
    return result.data;
}
//# sourceMappingURL=carLoader.js.map