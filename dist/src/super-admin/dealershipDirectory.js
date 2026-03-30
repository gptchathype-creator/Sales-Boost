"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEALERSHIP_DIRECTORY = void 0;
exports.getDealershipDirectory = getDealershipDirectory;
const mockOrganization_1 = require("./mockOrganization");
function resolveWorkingHours(city) {
    if (city === 'Санкт-Петербург')
        return { workStartHour: 10, workEndHour: 20 };
    if (city === 'Москва')
        return { workStartHour: 9, workEndHour: 20 };
    return { workStartHour: 10, workEndHour: 19 };
}
exports.DEALERSHIP_DIRECTORY = mockOrganization_1.MOCK_DEALERSHIP_SEEDS.map((seed) => ({
    id: seed.code,
    name: seed.name,
    city: seed.city,
    ...resolveWorkingHours(seed.city),
}));
function getDealershipDirectory() {
    return exports.DEALERSHIP_DIRECTORY;
}
//# sourceMappingURL=dealershipDirectory.js.map